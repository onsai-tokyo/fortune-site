-- Prerequisites: points, partner_profiles, D01. Local validation only; no live application.
begin;
create table public.compatibility_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 op_id uuid not null, worker_id uuid not null, source_id uuid not null, partner_id uuid not null,
 request_hash text not null, request_payload jsonb not null, input_snapshot jsonb not null, runtime_context jsonb not null,
 state text not null check(state in ('pending','completed','failed')),
 reserved_cost integer not null check(reserved_cost in (0,3)), refunded boolean not null default false,
 lease_until timestamptz not null,
 conversation_id uuid references public.reading_conversations(id) on delete set null,
 revision_id uuid references public.reading_revisions(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,op_id)
);
alter table public.compatibility_operations enable row level security;
revoke all on public.compatibility_operations from public,anon,authenticated,service_role;

-- Internal only. Row lock serializes completion, explicit failure, expiry and refund.
create function public.read_compatibility_operation(p_user uuid,p_op uuid,p_fail_worker uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.compatibility_operations; report jsonb;
begin
 select * into op from public.compatibility_operations where user_id=p_user and op_id=p_op for update;
 if not found then return jsonb_build_object('state','not_found'); end if;
 if op.state='pending' and (op.lease_until<=clock_timestamp() or op.worker_id=p_fail_worker
   or not exists(select 1 from public.partner_profiles where id=op.partner_id and user_id=p_user)
   or not exists(select 1 from public.reading_conversations where id=op.source_id and user_id=p_user)) then
   if op.reserved_cost>0 and not op.refunded then
     update public.user_points set balance=balance+op.reserved_cost,updated_at=now() where user_id=p_user;
     if not found then raise exception 'points_dependency_missing'; end if;
   end if;
   update public.compatibility_operations set state='failed',refunded=reserved_cost>0,updated_at=now()
   where user_id=p_user and op_id=p_op returning * into op;
 end if;
 if op.state='completed' then
   if op.conversation_id is null then return jsonb_build_object('state','deleted'); end if;
   select payload->'calculatedData'->'_structuredReport' into report from public.reading_revisions where id=op.revision_id;
   return jsonb_build_object('state','completed','result',report,'conversationId',op.conversation_id,'revisionId',op.revision_id);
 end if;
 return jsonb_build_object('state',op.state);
end $$;
revoke all on function public.read_compatibility_operation(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.get_compatibility_operation(p_user uuid,p_op uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select public.read_compatibility_operation(p_user,p_op);
$$;
create function public.fail_compatibility_operation(p_user uuid,p_op uuid,p_worker uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select public.read_compatibility_operation(p_user,p_op,p_worker);
$$;

-- Premium is determined by the trusted backend before this service-only RPC.
-- The price is the existing 3 points, never supplied by a caller.
create function public.begin_compatibility_operation(p_user uuid,p_op uuid,p_worker uuid,p_source uuid,p_partner uuid,p_request jsonb,p_context jsonb,p_premium boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.compatibility_operations; h text; source public.reading_conversations; partner public.partner_profiles;
 cost integer; balance_after integer; inputs jsonb;
begin
 if p_user is null or p_op is null or p_worker is null or p_source is null or p_partner is null or p_premium is null
   or jsonb_typeof(p_request) is distinct from 'object' or jsonb_typeof(p_context) is distinct from 'object' then raise exception 'invalid_compatibility_operation'; end if;
 h:=encode(sha256(convert_to(jsonb_build_object('source',p_source,'partner',p_partner,'request',p_request)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('compatibility-owner:'||p_user::text,0));
 select * into op from public.compatibility_operations where user_id=p_user and op_id=p_op for update;
 if found then
   if op.request_hash<>h then return jsonb_build_object('state','conflict'); end if;
   return public.read_compatibility_operation(p_user,p_op);
 end if;
 select * into source from public.reading_conversations where id=p_source and user_id=p_user and kind='self' for key share;
 if not found then return jsonb_build_object('state','source_not_found'); end if;
 select * into partner from public.partner_profiles where id=p_partner and user_id=p_user for share;
 if not found then return jsonb_build_object('state','partner_not_found'); end if;
 cost:=case when p_premium then 0 else 3 end;
 if cost>0 then
   update public.user_points set balance=balance-cost,updated_at=now() where user_id=p_user and balance>=cost returning balance into balance_after;
   if not found then
     if not exists(select 1 from public.user_points where user_id=p_user) then raise exception 'points_dependency_missing'; end if;
     return jsonb_build_object('state','insufficient_points');
   end if;
 end if;
 inputs:=jsonb_build_object('self',jsonb_build_object('id',source.id,'birth_data',source.birth_data,'calculated_data',source.calculated_data,'reading_revision_id',source.reading_revision_id),'partner',to_jsonb(partner));
 insert into public.compatibility_operations(user_id,op_id,worker_id,source_id,partner_id,request_hash,request_payload,input_snapshot,runtime_context,state,reserved_cost,lease_until)
 values(p_user,p_op,p_worker,p_source,p_partner,h,p_request,inputs,p_context,'pending',cost,clock_timestamp()+interval '5 minutes');
 return jsonb_build_object('state','started','input',inputs);
end $$;

-- Owner JWT plus an unexposed worker ID. D01 save and completion are one transaction.
create function public.complete_compatibility_operation(p_op uuid,p_worker uuid,p_payload jsonb,p_title text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare owner uuid:=auth.uid(); op public.compatibility_operations; state jsonb; saved jsonb; report jsonb;
begin
 if owner is null then raise exception 'authentication_required'; end if;
 select * into op from public.compatibility_operations where user_id=owner and op_id=p_op for update;
 if not found then return jsonb_build_object('state','not_found'); end if;
 state:=public.read_compatibility_operation(owner,p_op);
 if state->>'state'<>'pending' then return state; end if;
 if p_worker is null or p_worker<>op.worker_id then return state; end if;
 report:=p_payload->'calculatedData'->'_structuredReport';
 if p_payload->>'kind' is distinct from 'compatibility' or p_payload->>'partnerProfileId' is distinct from op.partner_id::text
   or p_payload->'birthData'->'self' is distinct from op.input_snapshot->'self'->'birth_data'
   or jsonb_typeof(report) is distinct from 'object' or coalesce(report->>'version','') not in ('2','3')
   or jsonb_typeof(report->'reportText') is distinct from 'string' or report->>'reportText' is distinct from p_payload->>'reportText'
   or jsonb_typeof(report->'cards') is distinct from 'array' then raise exception 'invalid_compatibility_result'; end if;
 if jsonb_array_length(report->'cards')=0 then raise exception 'empty_compatibility_result'; end if;
 saved:=public.save_reading_revision('compatibility:'||p_op::text,p_payload,p_title);
 if saved->>'id' is null or saved->>'revisionId' is null then raise exception 'compatibility_save_not_acknowledged'; end if;
 update public.compatibility_operations set state='completed',conversation_id=(saved->>'id')::uuid,revision_id=(saved->>'revisionId')::uuid,updated_at=now()
 where user_id=owner and op_id=p_op;
 return public.read_compatibility_operation(owner,p_op);
end $$;
revoke all on function public.get_compatibility_operation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.fail_compatibility_operation(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.begin_compatibility_operation(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.get_compatibility_operation(uuid,uuid) to service_role;
grant execute on function public.fail_compatibility_operation(uuid,uuid,uuid) to service_role;
grant execute on function public.begin_compatibility_operation(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,boolean) to service_role;
revoke all on function public.complete_compatibility_operation(uuid,uuid,jsonb,text) from public,anon,service_role;
grant execute on function public.complete_compatibility_operation(uuid,uuid,jsonb,text) to authenticated;
commit;
