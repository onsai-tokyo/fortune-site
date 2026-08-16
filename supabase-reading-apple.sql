-- Apple In-App Purchase subscriptions for the native iOS app.
create table if not exists public.app_store_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  original_transaction_id text not null unique,
  latest_transaction_id text not null,
  product_id text not null,
  environment text not null,
  subscription_status text not null default 'active',
  expires_at timestamptz,
  revoked_at timestamptz,
  app_account_token uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.app_store_notification_events (
  notification_uuid text primary key,
  notification_type text not null,
  subtype text,
  environment text,
  received_at timestamptz not null default now()
);

alter table public.app_store_subscriptions enable row level security;
alter table public.app_store_notification_events enable row level security;

drop policy if exists "Users read own App Store subscription" on public.app_store_subscriptions;
create policy "Users read own App Store subscription"
on public.app_store_subscriptions for select
to authenticated
using (auth.uid() = user_id);
