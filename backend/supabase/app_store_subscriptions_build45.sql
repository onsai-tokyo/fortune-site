begin;

create table if not exists public.app_store_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  original_transaction_id text not null unique,
  latest_transaction_id text not null,
  product_id text not null,
  environment text not null,
  subscription_status text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  app_account_token uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_store_notification_events (
  notification_uuid text primary key,
  notification_type text not null,
  subtype text,
  environment text,
  created_at timestamptz not null default now()
);

alter table public.app_store_subscriptions enable row level security;
alter table public.app_store_notification_events enable row level security;

commit;
