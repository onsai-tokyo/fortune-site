-- Independent relationship display settings. Immutable reading snapshots stay untouched.
begin;
create table if not exists public.couple_timeline_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_key text not null check (relationship_key ~ '^[0-9a-f]{64}$'),
  partner_profile_id uuid references public.partner_profiles(id) on delete cascade,
  meeting_year integer check (meeting_year between 1000 and 9999),
  updated_at timestamptz not null default now(),
  primary key(user_id,relationship_key)
);
alter table public.couple_timeline_settings enable row level security;
revoke all on public.couple_timeline_settings from public,anon,authenticated;
grant select,insert,update,delete on public.couple_timeline_settings to service_role;
-- API enforces conversation ownership and birth/current-year bounds before writes.
-- Absence of a row is null for existing users; no guessed migration values.
commit;
