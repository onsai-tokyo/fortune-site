begin;
create table public.self_generation_operations (
 user_id uuid not null references auth.users(id) on delete cascade, op_id uuid not null,
 payload_hash text not null, request_payload jsonb not null, runtime_context jsonb not null,
 worker_id uuid not null, state text not null check(state in ('pending','completed','failed')),
 lease_until timestamptz not null, result jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,op_id)
);
alter table public.self_generation_operations enable row level security;
revoke all on public.self_generation_operations from public,anon,authenticated,service_role;

create function public.get_self_generation(p_user uuid,p_op uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.self_generation_operations;
begin
 select * into op from public.self_generation_operations where user_id=p_user and op_id=p_op for update;
 if not found then return jsonb_build_object('state','not_found'); end if;
 if op.state='pending' and op.lease_until<=clock_timestamp() then
   update public.self_generation_operations set state='failed',updated_at=now() where user_id=p_user and op_id=p_op returning * into op;
 end if;
 return jsonb_build_object('state',op.state,'result',op.result);
end $$;

create function public.begin_self_generation(p_user uuid,p_op uuid,p_worker uuid,p_payload jsonb,p_context jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.self_generation_operations; h text;
begin
 if p_user is null or p_op is null or p_worker is null or jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_context) is distinct from 'object' then raise exception 'invalid_generation'; end if;
 h:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('self-generation:'||p_user::text,0));
 select * into op from public.self_generation_operations where user_id=p_user and op_id=p_op for update;
 if found then
   if op.payload_hash<>h then return jsonb_build_object('state','conflict'); end if;
   return public.get_self_generation(p_user,p_op);
 end if;
 insert into public.self_generation_operations(user_id,op_id,payload_hash,request_payload,runtime_context,worker_id,state,lease_until)
 values(p_user,p_op,h,p_payload,p_context,p_worker,'pending',clock_timestamp()+interval '5 minutes');
 return jsonb_build_object('state','started');
end $$;

create function public.settle_self_generation(p_user uuid,p_op uuid,p_worker uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.self_generation_operations;
begin
 select * into op from public.self_generation_operations where user_id=p_user and op_id=p_op for update;
 if not found then return jsonb_build_object('state','not_found'); end if;
 if op.state<>'pending' then return jsonb_build_object('state',op.state,'result',op.result); end if;
 if p_worker is null or op.worker_id<>p_worker or op.lease_until<=clock_timestamp() then return public.get_self_generation(p_user,p_op); end if;
 if p_result is not null and (jsonb_typeof(p_result) is distinct from 'object' or jsonb_typeof(p_result->'reportText') is distinct from 'string'
   or coalesce(p_result->>'reportText','')='' or coalesce(p_result->>'version','') not in ('2','3') or jsonb_typeof(p_result->'cards') is distinct from 'array') then raise exception 'invalid_generation_result'; end if;
 update public.self_generation_operations set state=case when p_result is null then 'failed' else 'completed' end,result=p_result,updated_at=now()
 where user_id=p_user and op_id=p_op returning * into op;
 return jsonb_build_object('state',op.state,'result',op.result);
end $$;
revoke all on function public.get_self_generation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.begin_self_generation(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.settle_self_generation(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.get_self_generation(uuid,uuid) to service_role;
grant execute on function public.begin_self_generation(uuid,uuid,uuid,jsonb,jsonb) to service_role;
grant execute on function public.settle_self_generation(uuid,uuid,uuid,jsonb) to service_role;
commit;
