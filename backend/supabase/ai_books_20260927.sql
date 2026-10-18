begin;
create table public.ai_book_settings (
  id boolean primary key default true check(id), enabled boolean not null default false,
  monthly_credits integer not null default 3 check(monthly_credits between 1 and 20), review_mode boolean not null default true
);
insert into public.ai_book_settings(id) values(true);
create table public.ai_book_grants (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null check(environment in ('Production','Sandbox')), transaction_id text not null,
  source text not null check(source in ('member','purchase')), quantity integer not null check(quantity between 1 and 20),
  starts_at timestamptz not null, expires_at timestamptz, revoked boolean not null default false,
  signed_ms bigint not null, created_at timestamptz not null default now(), unique(environment,transaction_id)
);
create table public.ai_books (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null, source_id uuid not null, target_title text not null, theme text not null, question text not null,
  source_snapshot jsonb not null, state text not null default 'queued' check(state in ('queued','generating','review','delivered','failed')),
  title text not null default 'あなたへの鑑定書', document jsonb, metadata jsonb,
  attempts integer not null default 0, lease_id uuid, lease_until timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), delivered_at timestamptz,
  unique(user_id,operation_id), check(char_length(question) between 20 and 400)
);
create table public.ai_book_credits (
  id uuid primary key default gen_random_uuid(), grant_id uuid not null references public.ai_book_grants(id) on delete cascade,
  slot integer not null, consumed_by uuid unique references public.ai_books(id) on delete set null,
  recovery_until timestamptz, unique(grant_id,slot)
);
create table public.ai_book_cancellations (
 user_id uuid not null references auth.users(id) on delete cascade, operation_id uuid not null,
 created_at timestamptz not null default now(), primary key(user_id,operation_id)
);
alter table public.ai_book_cancellations enable row level security;
revoke all on public.ai_book_cancellations from public,anon,authenticated;
grant select on public.ai_book_cancellations to service_role;
create index ai_books_owner on public.ai_books(user_id,created_at desc);
create index ai_books_queue on public.ai_books(state,created_at);
alter table public.ai_book_settings enable row level security;
alter table public.ai_book_grants enable row level security;
alter table public.ai_book_credits enable row level security;
alter table public.ai_books enable row level security;
revoke all on public.ai_book_settings,public.ai_book_grants,public.ai_book_credits,public.ai_books from public,anon,authenticated;
grant select,insert,update,delete on public.ai_book_settings,public.ai_book_grants,public.ai_book_credits,public.ai_books to service_role;

-- Called by trusted server code only AFTER Apple signature + product + owner verification.
create function public.ai_book_grant(p_user uuid,p_environment text,p_transaction text,p_source text,p_start timestamptz,p_end timestamptz,p_revoked boolean,p_signed bigint)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare g public.ai_book_grants; n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai-book-tx:'||p_environment||':'||p_transaction,0));
  select * into g from public.ai_book_grants where environment=p_environment and transaction_id=p_transaction for update;
  if found then
    if g.user_id<>p_user or g.source<>p_source then raise exception 'BOOK_OWNER_MISMATCH'; end if;
    if p_signed<g.signed_ms then return; end if;
    update public.ai_book_grants set revoked=revoked or p_revoked,signed_ms=p_signed where id=g.id;
    return;
  end if;
  select case when p_source='purchase' then 1 else monthly_credits end into n from public.ai_book_settings where id;
  insert into public.ai_book_grants(user_id,environment,transaction_id,source,quantity,starts_at,expires_at,revoked,signed_ms)
    values(p_user,p_environment,p_transaction,p_source,n,p_start,p_end,p_revoked,p_signed) returning * into g;
  insert into public.ai_book_credits(grant_id,slot) select g.id,generate_series(1,n);
end $$;
create function public.ai_book_subscription_event() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare tx jsonb; owner uuid;
begin
  if new.state<>'applied' or new.result->>'delivery'<>'mirrored' then return new; end if;
  if not (select enabled from public.ai_book_settings where id) then return new; end if;
  tx:=new.payload->'transaction'; owner:=(new.result->>'ownerId')::uuid;
  if exists(select 1 from public.ai_book_grants where environment=new.environment and transaction_id=tx->>'transactionId' and user_id<>owner) then
    update public.ai_book_grants set revoked=true where environment=new.environment and transaction_id=tx->>'transactionId';
    return new;
  end if;
  perform public.ai_book_grant(owner,new.environment,tx->>'transactionId','member',
    to_timestamp((tx->>'purchaseMs')::bigint/1000.0),to_timestamp((tx->>'expiresMs')::bigint/1000.0),
    tx->>'revokedMs' is not null or coalesce((tx->>'isUpgraded')::boolean,false),(tx->>'signedMs')::bigint);
  return new;
end $$;
create trigger ai_book_on_subscription after update of state on public.app_store_event_journal
for each row execute function public.ai_book_subscription_event();
create function public.ai_book_sync_member(p_user uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare r record; tx jsonb;
begin
  if not (select enabled from public.ai_book_settings where id) then return; end if;
  for r in select l.* from public.app_store_lineages l join public.app_store_subscriptions s
    on s.user_id=l.user_id and s.environment=l.environment and s.original_transaction_id=l.original_transaction_id
    where l.user_id=p_user and s.subscription_status='active' and s.expires_at>now() and l.payload is not null loop
    tx:=r.payload;
    if exists(select 1 from public.ai_book_grants where environment=r.environment and transaction_id=tx->>'transactionId' and user_id<>p_user) then continue; end if;
    perform public.ai_book_grant(p_user,r.environment,tx->>'transactionId','member',
      to_timestamp((tx->>'purchaseMs')::bigint/1000.0),to_timestamp((tx->>'expiresMs')::bigint/1000.0),
      tx->>'revokedMs' is not null or coalesce((tx->>'isUpgraded')::boolean,false),(tx->>'signedMs')::bigint);
  end loop;
end $$;
create function public.ai_book_order(p_user uuid,p_operation uuid,p_source uuid,p_target text,p_theme text,p_question text,p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_books; c uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai-book-user:'||p_user,0));
  select * into b from public.ai_books where user_id=p_user and operation_id=p_operation;
  if found then
    if b.source_id<>p_source or b.question<>p_question or b.theme<>p_theme then raise exception 'BOOK_OPERATION_CONFLICT'; end if;
    return b.id;
  end if;
  if exists(select 1 from public.ai_book_cancellations where user_id=p_user and operation_id=p_operation) then raise exception 'BOOK_CANCELLED'; end if;
  if not (select enabled from public.ai_book_settings where id) then raise exception 'BOOK_DISABLED'; end if;
  select cr.id into c from public.ai_book_credits cr join public.ai_book_grants g on g.id=cr.grant_id
    where g.user_id=p_user and not g.revoked and g.starts_at<=now() and cr.consumed_by is null
      and (g.expires_at is null or greatest(g.expires_at,cr.recovery_until)>now())
    order by greatest(g.expires_at,cr.recovery_until) asc nulls last,g.created_at,cr.slot
    limit 1 for update of cr,g;
  if c is null then raise exception 'BOOK_NO_CREDITS'; end if;
  insert into public.ai_books(user_id,operation_id,source_id,target_title,theme,question,source_snapshot)
    values(p_user,p_operation,p_source,p_target,p_theme,p_question,p_snapshot) returning * into b;
  update public.ai_book_credits set consumed_by=b.id where id=c;
  return b.id;
end $$;
-- Resolves an uncertain submission before releasing the client operation ID.
create function public.ai_book_cancel_unsubmitted(p_user uuid,p_operation uuid) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare existing uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-book-user:'||p_user,0));
 select id into existing from public.ai_books where user_id=p_user and operation_id=p_operation;
 if existing is not null then return existing; end if;
 insert into public.ai_book_cancellations(user_id,operation_id) values(p_user,p_operation) on conflict do nothing;
 return null;
end $$;
revoke all on function public.ai_book_cancel_unsubmitted(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ai_book_cancel_unsubmitted(uuid,uuid) to service_role;
create function public.ai_book_fail(p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_books;
begin
  select * into b from public.ai_books where id=p_id for update;
  if not found or b.state<>'generating' or b.lease_id is distinct from p_lease then return false; end if;
  update public.ai_books set state='failed',lease_until=null,lease_id=null,updated_at=now() where id=p_id;
  update public.ai_book_credits c set consumed_by=null,recovery_until=case when g.expires_at<=now() then now()+interval '7 days' else c.recovery_until end
    from public.ai_book_grants g where c.grant_id=g.id and c.consumed_by=p_id;
  return true;
end $$;
create function public.ai_book_claim() returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_books;
begin
  if not (select enabled from public.ai_book_settings where id) then return null; end if;
  select * into b from public.ai_books where state='queued' or (state='generating' and lease_until<now())
    order by created_at limit 1 for update skip locked;
  if not found then return null; end if;
  if b.attempts>=3 then perform public.ai_book_fail(b.id,b.lease_id); return null; end if;
  update public.ai_books set state='generating',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
    where id=b.id returning * into b;
  return to_jsonb(b);
end $$;
create function public.ai_book_finish(p_id uuid,p_lease uuid,p_document jsonb,p_metadata jsonb) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  update public.ai_books set document=p_document,metadata=p_metadata,title=p_document->>'title',
    state=case when (select review_mode from public.ai_book_settings where id) then 'review' else 'delivered' end,
    delivered_at=case when (select review_mode from public.ai_book_settings where id) then null else now() end,
    lease_id=null,lease_until=null,updated_at=now()
    where id=p_id and state='generating' and lease_id=p_lease and lease_until>now();
  return found;
end $$;
create function public.ai_book_review(p_id uuid,p_approve boolean) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  update public.ai_books set state=case when p_approve then 'delivered' else 'failed' end,
    delivered_at=case when p_approve then now() else null end,updated_at=now() where id=p_id and state='review';
  if not found then return false; end if;
  if not p_approve then
    update public.ai_book_credits c set consumed_by=null,recovery_until=case when g.expires_at<=now() then now()+interval '7 days' else c.recovery_until end
      from public.ai_book_grants g where c.grant_id=g.id and c.consumed_by=p_id;
  end if;
  return true;
end $$;
revoke all on function public.ai_book_grant(uuid,text,text,text,timestamptz,timestamptz,boolean,bigint),public.ai_book_subscription_event(),public.ai_book_sync_member(uuid),public.ai_book_order(uuid,uuid,uuid,text,text,text,jsonb),public.ai_book_fail(uuid,uuid),public.ai_book_claim(),public.ai_book_finish(uuid,uuid,jsonb,jsonb),public.ai_book_review(uuid,boolean) from public,anon,authenticated;
grant execute on function public.ai_book_grant(uuid,text,text,text,timestamptz,timestamptz,boolean,bigint),public.ai_book_sync_member(uuid),public.ai_book_order(uuid,uuid,uuid,text,text,text,jsonb),public.ai_book_fail(uuid,uuid),public.ai_book_claim(),public.ai_book_finish(uuid,uuid,jsonb,jsonb),public.ai_book_review(uuid,boolean) to service_role;
commit;
