-- After compatibility_operations_d02.sql. Local validation only; no live application.
begin;
-- Durable absence tombstones prevent a delayed begin from charging after cancellation.
create table public.compatibility_cancellations (
 user_id uuid not null references auth.users(id) on delete cascade,
 op_id uuid not null, created_at timestamptz not null default now(),
 primary key(user_id,op_id)
);
alter table public.compatibility_cancellations enable row level security;
revoke all on public.compatibility_cancellations from public,anon,authenticated,service_role;
create or replace function public.read_compatibility_operation(p_user uuid,p_op uuid,p_fail_worker uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.compatibility_operations; report jsonb;
begin
 if exists(select 1 from public.compatibility_cancellations where user_id=p_user and op_id=p_op) then return jsonb_build_object('state','failed'); end if;
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
create or replace function public.begin_compatibility_operation(p_user uuid,p_op uuid,p_worker uuid,p_source uuid,p_partner uuid,p_request jsonb,p_context jsonb,p_premium boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.compatibility_operations; h text; source public.reading_conversations; partner public.partner_profiles;
 cost integer; balance_after integer; inputs jsonb;
begin
 if p_user is null or p_op is null or p_worker is null or p_source is null or p_partner is null or p_premium is null
   or jsonb_typeof(p_request) is distinct from 'object' or jsonb_typeof(p_context) is distinct from 'object' then raise exception 'invalid_compatibility_operation'; end if;
 h:=encode(sha256(convert_to(jsonb_build_object('source',p_source,'partner',p_partner,'request',p_request)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('compatibility-owner:'||p_user::text,0));
 if exists(select 1 from public.compatibility_cancellations where user_id=p_user and op_id=p_op) then return jsonb_build_object('state','failed'); end if;
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

-- Trusted route derives p_user from its authenticated session. Active workers are not cancelled.
create function public.cancel_unstarted_compatibility_operation(p_user uuid,p_op uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare state jsonb;
begin
 if p_user is null or p_op is null then raise exception 'invalid_compatibility_operation'; end if;
 perform pg_advisory_xact_lock(hashtextextended('compatibility-owner:'||p_user::text,0));
 state:=public.read_compatibility_operation(p_user,p_op);
 if state->>'state'<>'not_found' then return state; end if;
 insert into public.compatibility_cancellations(user_id,op_id) values(p_user,p_op) on conflict do nothing;
 return jsonb_build_object('state','failed');
end $$;
revoke all on function public.cancel_unstarted_compatibility_operation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_unstarted_compatibility_operation(uuid,uuid) to service_role;
commit;
