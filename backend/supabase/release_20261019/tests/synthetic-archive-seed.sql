-- Fictional IDs/data only. Never a production script.
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111');
insert into public.ai_book_grants(id,user_id,environment,transaction_id,source,quantity,signed_ms)
 values('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Review','review:synthetic','review',1,0),
 ('44444444-4444-4444-8444-444444444445','11111111-1111-4111-8111-111111111111','Trial','trial:synthetic','trial',1,0);
insert into public.ai_books(id,user_id,question,state,source_snapshot)
 values('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111',
 '合成データです。実在する方の情報ではありません。','delivered','[]'::jsonb);
insert into public.ai_book_credits(id,grant_id,slot,consumed_by)
 values('88888888-8888-4888-8888-888888888888','44444444-4444-4444-8444-444444444444',1,'55555555-5555-4555-8555-555555555555');
insert into public.partner_profiles(id,user_id)
 values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
-- Exercise PostgreSQL's variable fractional precision with Python 3.9.
update public.ai_book_grants set starts_at='2026-10-19 11:00:00.12345+09',
 created_at='2026-10-19 11:00:00.1+09', expires_at='2026-10-20 11:00:00.1234+09';
update public.ai_book_credits set recovery_until='2026-10-20 11:00:00.12+09';
alter table public.ai_book_grants owner to postgres;
alter table public.ai_books owner to postgres;
alter table public.ai_book_credits owner to postgres;
alter table public.partner_profiles owner to postgres;
alter table public.partner_profiles enable row level security;
grant select,delete on public.partner_profiles to service_role;
alter function public.ai_book_question_begin(uuid,uuid,uuid,text) owner to postgres;
commit;
