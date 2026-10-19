-- Local restored fixture only. Entire test, including deletion, is rolled back.
begin;
do $$
declare partner_id uuid; owner_id uuid; other_partner uuid := gen_random_uuid();
begin
  select id,user_id into partner_id,owner_id from public.partner_profiles order by id limit 1;
  if not found then raise exception 'RESTORED_PARTNER_FIXTURE_UNAVAILABLE'; end if;
  insert into public.reading_saves(user_id,save_key) values
    (owner_id,'couple-'||partner_id::text||'-2026'),
    (owner_id,'couple-'||other_partner::text||'-2026'),
    (owner_id,'you-2026');
  -- partners.ts deletes via getSupabaseAdmin(): emulate its service_role.
  set local role service_role;
  delete from public.partner_profiles where id=partner_id and user_id=owner_id;
  reset role;
  if exists(select 1 from public.partner_profiles where id=partner_id) or
     exists(select 1 from public.reading_saves where user_id=owner_id and save_key='couple-'||partner_id::text||'-2026') or
     not exists(select 1 from public.reading_saves where user_id=owner_id and save_key='couple-'||other_partner::text||'-2026') or
     not exists(select 1 from public.reading_saves where user_id=owner_id and save_key='you-2026')
    then raise exception 'RESTORED_PARTNER_TRIGGER_MISMATCH'; end if;
end $$;
rollback;
