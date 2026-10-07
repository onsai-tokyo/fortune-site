-- Administrative review credits are distinct from verified Apple transactions.
-- Existing RLS, grants, member/purchase handling and credit consumption are unchanged.
begin;
alter table public.ai_book_grants drop constraint ai_book_grants_source_check;
alter table public.ai_book_grants add constraint ai_book_grants_source_check
check (source in ('member','purchase') or
  (source='review' and environment='Sandbox' and signed_ms=0
   and transaction_id like 'admin-review:%'));
commit;
