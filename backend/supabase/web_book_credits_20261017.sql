begin;

-- Web credits are consumable and have no membership expiry.  Keep Apple grants
-- unchanged while allowing a separate, idempotent order namespace.
-- Do not replace the deployed predicates: staging/production may contain
-- review/trial grants that are not present in the original bootstrap SQL.
-- Read the live definitions and extend them with the Web case.
do $$
declare
  c record;
  expression text;
begin
  select pg_get_constraintdef(oid, true) into c
    from pg_constraint
   where conrelid = 'public.ai_book_grants'::regclass
     and conname = 'ai_book_grants_environment_check';
  if c is null then raise exception 'MISSING ai_book_grants_environment_check'; end if;
  if position('environment = ''web''' in lower(c.pg_get_constraintdef)) = 0 then
    expression := substring(substring(c.pg_get_constraintdef from 7) from 2 for char_length(substring(c.pg_get_constraintdef from 7)) - 2);
    if expression is null then raise exception 'INVALID ai_book_grants_environment_check'; end if;
    execute 'alter table public.ai_book_grants drop constraint ai_book_grants_environment_check';
    execute 'alter table public.ai_book_grants add constraint ai_book_grants_environment_check check ((' || expression || ') or (environment = ''Web''))';
  end if;

  select pg_get_constraintdef(oid, true) into c
    from pg_constraint
   where conrelid = 'public.ai_book_grants'::regclass
     and conname = 'ai_book_grants_source_check';
  if c is null then raise exception 'MISSING ai_book_grants_source_check'; end if;
  if position('source = ''web''' in lower(c.pg_get_constraintdef)) = 0 then
    expression := substring(substring(c.pg_get_constraintdef from 7) from 2 for char_length(substring(c.pg_get_constraintdef from 7)) - 2);
    if expression is null then raise exception 'INVALID ai_book_grants_source_check'; end if;
    execute 'alter table public.ai_book_grants drop constraint ai_book_grants_source_check';
    execute 'alter table public.ai_book_grants add constraint ai_book_grants_source_check check ((' || expression || ') or (source = ''web'' and environment = ''Web''))';
  end if;
end $$;

create or replace function public.ai_book_grant_web(
  p_user uuid,
  p_order_id text,
  p_quantity integer
) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  g public.ai_book_grants;
begin
  if p_user is null or p_order_id is null or length(trim(p_order_id)) = 0
     or p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'WEB_BOOK_GRANT_INPUT';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai-book-web-order:' || p_order_id, 0));
  select * into g from public.ai_book_grants
    where environment='Web' and transaction_id=p_order_id for update;
  if found then
    if g.user_id <> p_user then raise exception 'BOOK_OWNER_MISMATCH'; end if;
    return;
  end if;

  insert into public.ai_book_grants(
    user_id, environment, transaction_id, source, quantity,
    starts_at, expires_at, revoked, signed_ms
  ) values (
    p_user, 'Web', p_order_id, 'web', p_quantity,
    now(), null, false, floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  ) returning * into g;

  insert into public.ai_book_credits(grant_id, slot)
    select g.id, generate_series(1, p_quantity);
end $$;

revoke all on function public.ai_book_grant_web(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.ai_book_grant_web(uuid,text,integer) to service_role;
commit;
