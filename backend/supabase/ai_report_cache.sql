create table if not exists public.ai_report_cache (
  cache_key text primary key,
  generator_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_report_cache enable row level security;
revoke all on public.ai_report_cache from anon, authenticated;
