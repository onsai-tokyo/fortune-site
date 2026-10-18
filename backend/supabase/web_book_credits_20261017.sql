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

-- Add a Web-only order path. Never replace the deployed iOS ai_book_order:
-- its membership / DeviceCheck / trial-month cap rules must remain unchanged.
create or replace function public.ai_book_order_web(
  p_user uuid, p_operation uuid, p_source uuid, p_target text,
  p_theme text, p_question text, p_snapshot jsonb
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_books; credit_id uuid;
begin
  if p_user is null or p_operation is null or p_source is null
     or jsonb_typeof(p_snapshot) is distinct from 'array' then
    raise exception 'BOOK_INPUT';
  end if;
  -- Same lock family as the iOS order path, so neither can double-consume.
  perform pg_advisory_xact_lock(hashtextextended('ai-book-user:' || p_user, 0));
  select * into b from public.ai_books where user_id=p_user and operation_id=p_operation;
  if found then
    if b.funding_source is distinct from 'web' or b.source_id<>p_source
       or b.question<>p_question or b.theme<>p_theme then raise exception 'BOOK_OPERATION_CONFLICT'; end if;
    return b.id;
  end if;
  if exists(select 1 from public.ai_book_cancellations where user_id=p_user and operation_id=p_operation)
    then raise exception 'BOOK_CANCELLED'; end if;
  if not exists(select 1 from public.ai_book_settings where id and enabled)
    then raise exception 'BOOK_DISABLED'; end if;
  if not exists(select 1 from public.reading_conversations where id=p_source and user_id=p_user and kind in ('self','personal','compatibility'))
    then raise exception 'BOOK_SOURCE'; end if;
  select cr.id into credit_id from public.ai_book_credits cr
    join public.ai_book_grants g on g.id=cr.grant_id
    where g.user_id=p_user and g.environment='Web' and g.source='web'
      and not g.revoked and g.starts_at<=now() and cr.consumed_by is null
      and (g.expires_at is null or greatest(g.expires_at,cr.recovery_until)>now())
    order by greatest(g.expires_at,cr.recovery_until) asc nulls last,g.created_at,cr.slot
    limit 1 for update of cr,g;
  if credit_id is null then raise exception 'BOOK_NO_CREDITS'; end if;
  insert into public.ai_books(user_id,operation_id,source_id,target_title,theme,question,source_snapshot,funding_source)
    values(p_user,p_operation,p_source,p_target,p_theme,p_question,p_snapshot,'web') returning * into b;
  update public.ai_book_credits set consumed_by=b.id where id=credit_id;
  return b.id;
end $$;
revoke all on function public.ai_book_order_web(uuid,uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ai_book_order_web(uuid,uuid,uuid,text,text,text,jsonb) to service_role;
commit;
