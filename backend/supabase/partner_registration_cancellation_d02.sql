-- After partner_registration_d02.sql. Local verification only; no live application.
begin;
create table public.partner_registration_cancellations (
 user_id uuid not null references auth.users(id) on delete cascade,
 op_id uuid not null, created_at timestamptz not null default now(),
 primary key(user_id,op_id)
);
alter table public.partner_registration_cancellations enable row level security;
revoke all on public.partner_registration_cancellations from public,anon,authenticated,service_role;
create or replace function public.get_partner_registration_operation(p_user uuid,p_op uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare operation public.partner_registration_operations; partner public.partner_profiles;
begin
 if exists(select 1 from public.partner_registration_cancellations where user_id=p_user and op_id=p_op) then return jsonb_build_object('state','cancelled'); end if;
 select * into operation from public.partner_registration_operations where user_id=p_user and op_id=p_op;
 if not found then return jsonb_build_object('state','not_found'); end if;
 select * into partner from public.partner_profiles where id=operation.partner_id and user_id=p_user;
 if not found then return jsonb_build_object('state','deleted'); end if;
 return jsonb_build_object('state','completed','partner',to_jsonb(partner),'remaining',greatest(0,2-(select count(*) from public.partner_profiles where user_id=p_user)));
end $$;
create or replace function public.register_partner_operation(p_user uuid,p_op uuid,p_profile jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare operation public.partner_registration_operations; h text; saved uuid;
begin
 if p_user is null or p_op is null or jsonb_typeof(p_profile) is distinct from 'object' then raise exception 'invalid_partner_registration'; end if;
 h:=encode(sha256(convert_to(p_profile::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('partner-registration-owner:'||p_user::text,0));
 if exists(select 1 from public.partner_registration_cancellations where user_id=p_user and op_id=p_op) then return jsonb_build_object('state','cancelled'); end if;
 select * into operation from public.partner_registration_operations where user_id=p_user and op_id=p_op;
 if found then
   if operation.request_hash<>h then return jsonb_build_object('state','conflict'); end if;
   return public.get_partner_registration_operation(p_user,p_op);
 end if;
 if (select count(*) from public.partner_profiles where user_id=p_user)>=2 then return jsonb_build_object('state','limit'); end if;
 insert into public.partner_profiles(user_id,display_name,birth_date,birth_time,birthplace,gender,relationship_type,relationship_label)
 values(p_user,p_profile->>'display_name',(p_profile->>'birth_date')::date,(p_profile->>'birth_time')::time,p_profile->>'birthplace',p_profile->>'gender',p_profile->>'relationship_type',p_profile->>'relationship_label') returning id into saved;
 insert into public.partner_registration_operations(user_id,op_id,request_hash,partner_id) values(p_user,p_op,h,saved);
 return public.get_partner_registration_operation(p_user,p_op);
end $$;

-- Only cancel absence. A registration that wins the owner lock remains intact.
create function public.cancel_partner_registration_operation(p_user uuid,p_op uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare state jsonb;
begin
 if p_user is null or p_op is null then raise exception 'invalid_partner_registration'; end if;
 perform pg_advisory_xact_lock(hashtextextended('partner-registration-owner:'||p_user::text,0));
 state:=public.get_partner_registration_operation(p_user,p_op);
 if state->>'state'<>'not_found' then return state; end if;
 insert into public.partner_registration_cancellations(user_id,op_id) values(p_user,p_op) on conflict do nothing;
 return jsonb_build_object('state','cancelled');
end $$;
revoke all on function public.cancel_partner_registration_operation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_partner_registration_operation(uuid,uuid) to service_role;
commit;
