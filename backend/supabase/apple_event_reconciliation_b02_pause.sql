-- Optional operational pause; NOT executed by tests or deployment tooling.
-- Preserve receipts, projections, ownership and audit history. API callers retry.
begin;
revoke execute on function public.app_store_apply_event(text,text) from service_role;
commit;
-- After the cause is resolved and separately approved:
-- grant execute on function public.app_store_apply_event(text,text) to service_role;
