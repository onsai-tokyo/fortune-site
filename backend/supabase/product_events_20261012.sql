begin;
create table public.product_events (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 event text not null check(event in ('registration_completed','timeline_viewed','book_create_tapped','paywall_viewed','purchase_completed','trial_granted','trial_book_ordered','trial_book_delivered')),
 event_key text not null unique, origin text not null check(origin in ('client','server')),
 properties jsonb not null default '{}', occurred_at timestamptz not null default now(), received_at timestamptz not null default now()
);
create function public.product_event_unlink() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.user_id is null and old.user_id is not null then new.event_key:='deleted:'||new.id; end if;
 return new;
end $$;
create trigger product_event_unlink before update of user_id on public.product_events for each row execute function public.product_event_unlink();
create index product_events_cohort on public.product_events(event,occurred_at,user_id);
alter table public.product_events enable row level security;
revoke all on public.product_events from public,anon,authenticated;
grant select,insert on public.product_events to service_role;
-- Analytics failure must never reject registration or a verified purchase.
create function public.product_registration_event() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.email_confirmed_at is not null and (tg_op='INSERT' or old.email_confirmed_at is null) then
  insert into public.product_events(user_id,event,event_key,origin,properties)
   values(new.id,'registration_completed','registration:'||new.id,'server',jsonb_build_object('trialEnabled',coalesce((select (to_jsonb(s)->>'trial_enabled')::boolean from public.ai_book_settings s where id),false))) on conflict do nothing;
 end if;
 return new;
exception when others then raise warning 'product_registration_event unavailable'; return new;
end $$;
create trigger product_registration_event after insert or update of email_confirmed_at on auth.users for each row execute function public.product_registration_event();
create function public.product_purchase_event() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare tx jsonb;
begin
 if new.state='applied' and new.result->>'delivery'='mirrored' then
  tx:=new.payload->'transaction';
  if tx->>'revokedMs' is null and not coalesce((tx->>'isUpgraded')::boolean,false) then
   insert into public.product_events(user_id,event,event_key,origin,occurred_at,properties)
    values((new.result->>'ownerId')::uuid,'purchase_completed','apple:'||new.environment||':'||(tx->>'transactionId'),'server',
      to_timestamp((tx->>'purchaseMs')::bigint/1000.0),jsonb_build_object('environment',new.environment,'productId',tx->>'productId')) on conflict do nothing;
  end if;
 end if;
 return new;
exception when others then raise warning 'product_purchase_event unavailable'; return new;
end $$;
create trigger product_purchase_event after update of state on public.app_store_event_journal for each row execute function public.product_purchase_event();
create function public.product_credit_event() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.source='purchase' and not new.revoked then
  insert into public.product_events(user_id,event,event_key,origin,occurred_at,properties)
   values(new.user_id,'purchase_completed','apple:'||new.environment||':'||new.transaction_id,'server',new.starts_at,
     jsonb_build_object('environment',new.environment,'kind','extra_book')) on conflict do nothing;
 elsif new.source='trial' then
  insert into public.product_events(user_id,event,event_key,origin) values(new.user_id,'trial_granted','trial-grant:'||new.id,'server') on conflict do nothing;
 end if;
 return new;
exception when others then raise warning 'product_credit_event unavailable'; return new;
end $$;
create trigger product_credit_event after insert on public.ai_book_grants for each row execute function public.product_credit_event();
create function public.product_trial_order_event() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare owner uuid; kind text;
begin
 if new.consumed_by is not null and new.consumed_by is distinct from old.consumed_by then
  select user_id,source into owner,kind from public.ai_book_grants where id=new.grant_id;
  if kind='trial' then
   insert into public.product_events(user_id,event,event_key,origin) values(owner,'trial_book_ordered','trial-order:'||new.consumed_by,'server') on conflict do nothing;
  end if;
 end if;
 return new;
exception when others then raise warning 'product_trial_order_event unavailable'; return new;
end $$;
create trigger product_trial_order_event after update of consumed_by on public.ai_book_credits for each row execute function public.product_trial_order_event();
create function public.product_trial_delivery_event() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.state='delivered' and old.state<>'delivered' and exists(select 1 from public.product_events where event_key='trial-order:'||new.id) then
  insert into public.product_events(user_id,event,event_key,origin) values(new.user_id,'trial_book_delivered','trial-delivered:'||new.id,'server') on conflict do nothing;
 end if;
 return new;
exception when others then raise warning 'product_trial_delivery_event unavailable'; return new;
end $$;
create trigger product_trial_delivery_event after update of state on public.ai_books for each row execute function public.product_trial_delivery_event();
revoke all on function public.product_registration_event(),public.product_purchase_event(),public.product_credit_event(),public.product_trial_order_event(),public.product_trial_delivery_event() from public,anon,authenticated;
commit;
