begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111');
insert into public.partner_profiles(id,user_id)
 values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
insert into public.reading_saves(user_id,save_key) values
 ('11111111-1111-4111-8111-111111111111','couple-22222222-2222-4222-8222-222222222222-2026'),
 ('11111111-1111-4111-8111-111111111111','couple-33333333-3333-4333-8333-333333333333-2026'),
 ('11111111-1111-4111-8111-111111111111','you-2026');
delete from public.partner_profiles where id='22222222-2222-4222-8222-222222222222';
do $$ begin
 if exists(select 1 from public.reading_saves where save_key='couple-22222222-2222-4222-8222-222222222222-2026')
 or (select count(*) from public.reading_saves)<>2 then raise exception 'PARTNER_SAVE_TRIGGER_MISMATCH'; end if;
end $$;
rollback;
