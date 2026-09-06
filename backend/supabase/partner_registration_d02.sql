-- After partner_profiles.sql and partner_relationship_build45.sql. Local validation only.
begin;
alter table public.partner_profiles drop constraint partner_profiles_relationship_type_check;
alter table public.partner_profiles add constraint partner_profiles_relationship_type_check check (relationship_type in ('romantic','friend','family'));

create table public.partner_registration_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 op_id uuid not null, request_hash text not null,
 partner_id uuid references public.partner_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(user_id,op_id)
);
alter table public.partner_registration_operations enable row level security;
revoke all on public.partner_registration_operations from public,anon,authenticated,service_role;

-- Covers the RPC and other inserts using the existing trigger. The cap remains two.
create or replace function public.enforce_partner_profile_limit() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('partner-registration-owner:'||new.user_id::text,0));
 if (select count(*) from public.partner_profiles where user_id=new.user_id)>=2 then raise exception 'partner_profile_limit'; end if;
 return new;
end $$;

create function public.get_partner_registration_operation(p_user uuid,p_op uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare operation public.partner_registration_operations; partner public.partner_profiles;
begin
 select * into operation from public.partner_registration_operations where user_id=p_user and op_id=p_op;
 if not found then return jsonb_build_object('state','not_found'); end if;
 select * into partner from public.partner_profiles where id=operation.partner_id and user_id=p_user;
 if not found then return jsonb_build_object('state','deleted'); end if;
 return jsonb_build_object('state','completed','partner',to_jsonb(partner),'remaining',greatest(0,2-(select count(*) from public.partner_profiles where user_id=p_user)));
end $$;

create function public.register_partner_operation(p_user uuid,p_op uuid,p_profile jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare operation public.partner_registration_operations; h text; saved uuid;
begin
 if p_user is null or p_op is null or jsonb_typeof(p_profile) is distinct from 'object' then raise exception 'invalid_partner_registration'; end if;
 h:=encode(sha256(convert_to(p_profile::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('partner-registration-owner:'||p_user::text,0));
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
revoke all on function public.get_partner_registration_operation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.register_partner_operation(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.get_partner_registration_operation(uuid,uuid) to service_role;
grant execute on function public.register_partner_operation(uuid,uuid,jsonb) to service_role;
commit;
