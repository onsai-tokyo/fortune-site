begin;
alter table public.ai_book_settings add column trial_enabled boolean not null default false,
 add column trial_monthly_cap integer not null default 500 check(trial_monthly_cap>=0),
 add column trial_expiry_days integer not null default 30 check(trial_expiry_days between 1 and 365);
alter table public.ai_books add column funding_source text;
create table public.ai_book_device_claims (
 id uuid primary key, user_id uuid references auth.users(id) on delete set null,
 token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
 state text not null check(state in ('checking','writing','granted','denied','indeterminate')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Serialize Apple checks; expired ambiguous writes are fenced, never allowed to grant.
create unique index ai_book_device_active on public.ai_book_device_claims((true)) where state in ('checking','writing');
create unique index ai_book_device_user on public.ai_book_device_claims(user_id) where state in ('checking','writing','granted','indeterminate');
create table public.ai_book_trial_orders (
 book_id uuid primary key, month_jst date not null, accepted_at timestamptz not null default now()
); -- Deliberately no FK: deletion/refund cannot replenish the global monthly budget.
create index ai_book_trial_orders_month on public.ai_book_trial_orders(month_jst);
alter table public.ai_book_device_claims enable row level security;
alter table public.ai_book_trial_orders enable row level security;
revoke all on public.ai_book_device_claims,public.ai_book_trial_orders from public,anon,authenticated,service_role;
grant select on public.ai_book_device_claims,public.ai_book_trial_orders to service_role;
create function public.ai_book_is_member(p_user uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.app_store_subscriptions where user_id=p_user and subscription_status in ('active','trialing') and revoked_at is null and (expires_at is null or expires_at>now()))
 or exists(select 1 from public.stripe_subscriptions where user_id=p_user and subscription_status in ('active','trialing') and (current_period_end is null or current_period_end>now()));
$$;
create function public.ai_book_trial_eligible(p_user uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce((select enabled and trial_enabled from public.ai_book_settings where id),false)
 and not public.ai_book_is_member(p_user)
 and exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null)
 and not exists(select 1 from public.ai_book_grants where user_id=p_user and source='trial')
 and not exists(select 1 from public.ai_book_device_claims where user_id=p_user and state in ('granted','indeterminate'))
 and not exists(select 1 from public.ai_book_trial_claims c,auth.users u,public.ai_book_trial_secret s
   where u.id=p_user and s.id and c.fingerprint=encode(sha256(convert_to(s.secret||':'||lower(trim(u.email)),'UTF8')),'hex'));
$$;
create function public.ai_book_device_begin(p_user uuid,p_id uuid,p_hash text) returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.ai_book_device_claims;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-book-device-global',0));
 -- A late Apple bit0=true write is harmless, but its expired request MUST NOT mint.
 -- Keep the affected account blocked; only unrelated claimants may proceed.
 update public.ai_book_device_claims set state='indeterminate',updated_at=now()
  where state='writing' and updated_at<now()-interval '5 minutes';
 select * into r from public.ai_book_device_claims where id=p_id;
 if found then
  if r.user_id is distinct from p_user or r.token_hash<>p_hash then raise exception 'BOOK_TRIAL_CONFLICT'; end if;
  return r.state;
 end if;
 if not public.ai_book_trial_eligible(p_user) then return 'denied'; end if;
 -- A checking reservation has not authorized an Apple write. Expiring it is safe:
 -- an old process must still CAS checking -> writing before it can write.
 update public.ai_book_device_claims set state='denied',updated_at=now()
  where state='checking' and updated_at<now()-interval '2 minutes';
 if exists(select 1 from public.ai_book_device_claims where state in ('checking','writing')) then raise exception 'BOOK_TRIAL_BUSY'; end if;
 insert into public.ai_book_device_claims(id,user_id,token_hash,state) values(p_id,p_user,p_hash,'checking');
 return 'checking';
end $$;
create function public.ai_book_device_transition(p_user uuid,p_id uuid,p_hash text,p_expected text,p_next text) returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.ai_book_device_claims;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-book-device-global',0));
 -- A late Apple bit0=true write is harmless, but its expired request MUST NOT mint.
 -- Keep the affected account blocked; only unrelated claimants may proceed.
 update public.ai_book_device_claims set state='indeterminate',updated_at=now()
  where state='writing' and updated_at<now()-interval '5 minutes';
 select * into r from public.ai_book_device_claims where id=p_id for update;
 if not found or r.user_id is distinct from p_user or r.token_hash<>p_hash then raise exception 'BOOK_TRIAL_CONFLICT'; end if;
 if r.state<>p_expected then return r.state; end if;
 if not (p_expected='checking' and p_next in ('writing','denied')) then raise exception 'BOOK_TRIAL_CONFLICT'; end if;
 update public.ai_book_device_claims set state=p_next,updated_at=now() where id=p_id;
 return p_next;
end $$;
create function public.ai_book_device_finish(p_user uuid,p_id uuid,p_hash text) returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.ai_book_device_claims; fingerprint text; grant_id uuid; days integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-book-device-global',0));
 -- A late Apple bit0=true write is harmless, but its expired request MUST NOT mint.
 -- Keep the affected account blocked; only unrelated claimants may proceed.
 update public.ai_book_device_claims set state='indeterminate',updated_at=now()
  where state='writing' and updated_at<now()-interval '5 minutes';
 perform pg_advisory_xact_lock(hashtextextended('ai-book-user:'||p_user,0));
 select * into r from public.ai_book_device_claims where id=p_id for update;
 if not found or r.user_id is distinct from p_user or r.token_hash<>p_hash then raise exception 'BOOK_TRIAL_CONFLICT'; end if;
 if r.state='granted' then return 'granted'; end if;
 if r.state='indeterminate' then return 'indeterminate'; end if;
 if r.state<>'writing' then raise exception 'BOOK_TRIAL_CONFLICT'; end if;
 -- Fulfil the previously accepted reservation even if membership was bought meanwhile.
 -- OFF blocks use; it must not orphan a reservation already marked at Apple.
 select trial_expiry_days into days from public.ai_book_settings where id;
 select encode(sha256(convert_to(s.secret||':'||lower(trim(u.email)),'UTF8')),'hex') into fingerprint
  from auth.users u,public.ai_book_trial_secret s where u.id=p_user and s.id;
 if fingerprint is null then raise exception 'BOOK_TRIAL_CONFLICT'; end if;
 insert into public.ai_book_trial_claims values(fingerprint,now()) on conflict do nothing;
 insert into public.ai_book_grants(user_id,environment,transaction_id,source,quantity,starts_at,expires_at,revoked,signed_ms)
  values(p_user,'Production','trial:device:'||p_id,'trial',1,now(),now()+make_interval(days=>days),false,0) returning id into grant_id;
 insert into public.ai_book_credits(grant_id,slot) values(grant_id,1);
 update public.ai_book_device_claims set state='granted',updated_at=now() where id=p_id;
 return 'granted';
end $$;
-- Do not issue a trial from legacy status/order calls or revoke it on membership purchase.
-- Existing legacy trials are revoked by the pre-existing OFF contract; new DeviceCheck trials are hidden while OFF.
create or replace function public.ai_book_sync_trial(p_user uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not (select trial_enabled from public.ai_book_settings where id) then
  update public.ai_book_grants set revoked=true where user_id=p_user and source='trial' and transaction_id not like 'trial:device:%'
   and exists(select 1 from public.ai_book_grants where user_id=p_user and source='member');
 end if;
end $$;
create or replace function public.ai_book_order(p_user uuid,p_operation uuid,p_source uuid,p_target text,p_theme text,p_question text,p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_books; c uuid; kind text; cfg public.ai_book_settings; member boolean; month_start date; trial_available boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-book-user:'||p_user,0));
 select * into b from public.ai_books where user_id=p_user and operation_id=p_operation;
 if found then
  if b.source_id<>p_source or b.question<>p_question or b.theme<>p_theme then raise exception 'BOOK_OPERATION_CONFLICT'; end if;
  return b.id;
 end if;
 if exists(select 1 from public.ai_book_cancellations where user_id=p_user and operation_id=p_operation) then raise exception 'BOOK_CANCELLED'; end if;
 select * into cfg from public.ai_book_settings where id;
 if not cfg.enabled then raise exception 'BOOK_DISABLED'; end if;
 member:=public.ai_book_is_member(p_user);
 -- Serialize cap checks with all trial orders. Counter uses JST acceptance month, not allocation or delivery.
 month_start:=date_trunc('month',now() at time zone 'Asia/Tokyo')::date;
 if cfg.trial_enabled then perform pg_advisory_xact_lock(hashtextextended('ai-book-trial-month:'||month_start,0)); end if;
 select exists(select 1 from public.ai_book_credits cr join public.ai_book_grants g on g.id=cr.grant_id
  where g.user_id=p_user and g.source='trial' and g.transaction_id like 'trial:device:%' and not g.revoked and g.starts_at<=now()
   and g.expires_at>now() and cr.consumed_by is null) into trial_available;
 if not member and not (cfg.trial_enabled and trial_available) then raise exception 'BOOK_MEMBERSHIP_REQUIRED'; end if;
 if cfg.trial_enabled and trial_available and (select count(*) from public.ai_book_trial_orders where month_jst=month_start)>=cfg.trial_monthly_cap then
  if not member then raise exception 'BOOK_TRIAL_PAUSED'; end if;
  trial_available:=false; -- Paying members can still use paid allocations.
 end if;
 select cr.id,g.source into c,kind from public.ai_book_credits cr join public.ai_book_grants g on g.id=cr.grant_id
  where g.user_id=p_user and not g.revoked and g.starts_at<=now() and cr.consumed_by is null
   and (case when g.source='trial' then g.expires_at>now() else (g.expires_at is null or greatest(g.expires_at,cr.recovery_until)>now()) end)
   and ((g.source='trial' and cfg.trial_enabled and trial_available and g.transaction_id like 'trial:device:%') or (member and g.source<>'trial'))
  order by case when not cfg.trial_enabled then 0 when g.source='trial' then 0 when g.source='member' then 1 else 2 end,greatest(g.expires_at,cr.recovery_until) asc nulls last,g.created_at,cr.slot
  limit 1 for update of cr,g;
 if c is null then raise exception 'BOOK_NO_CREDITS'; end if;
 insert into public.ai_books(user_id,operation_id,source_id,target_title,theme,question,source_snapshot,funding_source)
  values(p_user,p_operation,p_source,p_target,p_theme,p_question,p_snapshot,kind) returning * into b;
 update public.ai_book_credits set consumed_by=b.id where id=c;
 if kind='trial' then insert into public.ai_book_trial_orders(book_id,month_jst) values(b.id,month_start); end if;
 return b.id;
end $$;
revoke all on function public.ai_book_is_member(uuid),public.ai_book_trial_eligible(uuid),public.ai_book_device_begin(uuid,uuid,text),public.ai_book_device_transition(uuid,uuid,text,text,text),public.ai_book_device_finish(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ai_book_is_member(uuid),public.ai_book_trial_eligible(uuid),public.ai_book_device_begin(uuid,uuid,text),public.ai_book_device_transition(uuid,uuid,text,text,text),public.ai_book_device_finish(uuid,uuid,text) to service_role;
commit;
