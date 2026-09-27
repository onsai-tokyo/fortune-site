-- Free: 1 partner; active monthly member: 10. Existing profiles are retained.
begin;
create or replace function public.partner_profile_capacity(p_user uuid)
returns integer language sql stable security definer set search_path=pg_catalog,public as $$
 select case when exists(select 1 from public.stripe_subscriptions where user_id=p_user and subscription_status in ('active','trialing') and (current_period_end is null or current_period_end>now()))
 or exists(select 1 from public.app_store_subscriptions where user_id=p_user and subscription_status in ('active','trialing') and revoked_at is null and (expires_at is null or expires_at>now())) then 10 else 1 end;
$$;
revoke all on function public.partner_profile_capacity(uuid) from public,anon,authenticated;
grant execute on function public.partner_profile_capacity(uuid) to service_role;
create or replace function public.enforce_partner_profile_limit() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('partner-registration-owner:'||new.user_id::text,0));
 if (select count(*) from public.partner_profiles where user_id=new.user_id)>=public.partner_profile_capacity(new.user_id) then raise exception 'partner_profile_limit'; end if;
 return new;
end $$;
create or replace function public.get_partner_registration_operation(p_user uuid,p_op uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare operation public.partner_registration_operations; partner public.partner_profiles;
begin
 if exists(select 1 from public.partner_registration_cancellations where user_id=p_user and op_id=p_op) then return jsonb_build_object('state','cancelled'); end if;
 select * into operation from public.partner_registration_operations where user_id=p_user and op_id=p_op;
 if not found then return jsonb_build_object('state','not_found'); end if;
 select * into partner from public.partner_profiles where id=operation.partner_id and user_id=p_user;
 if not found then return jsonb_build_object('state','deleted'); end if;
 return jsonb_build_object('state','completed','partner',to_jsonb(partner),'remaining',greatest(0,public.partner_profile_capacity(p_user)-(select count(*) from public.partner_profiles where user_id=p_user)));
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
 if (select count(*) from public.partner_profiles where user_id=p_user)>=public.partner_profile_capacity(p_user) then return jsonb_build_object('state','limit'); end if;
 insert into public.partner_profiles(user_id,display_name,birth_date,birth_time,birthplace,gender,relationship_type,relationship_label)
 values(p_user,p_profile->>'display_name',(p_profile->>'birth_date')::date,(p_profile->>'birth_time')::time,p_profile->>'birthplace',p_profile->>'gender',p_profile->>'relationship_type',p_profile->>'relationship_label') returning id into saved;
 insert into public.partner_registration_operations(user_id,op_id,request_hash,partner_id) values(p_user,p_op,h,saved);
 return public.get_partner_registration_operation(p_user,p_op);
end $$;

commit;
