-- Apply once before enabling the web collector. No PII/content/GA identifiers stored here.
begin;
create table public.signup_analytics_receipts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.signup_analytics_receipts enable row level security;
revoke all on public.signup_analytics_receipts from public, anon, authenticated;

-- Confirmed accounts at rollout are NOT new registrations, including accounts
-- initially created anonymously and subsequently upgraded to email accounts.
insert into public.signup_analytics_receipts(user_id)
select id from auth.users where email_confirmed_at is not null and not coalesce(is_anonymous, false);

create function public.claim_signup_analytics()
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare inserted integer;
begin
  if auth.uid() is null then return false; end if;
  insert into public.signup_analytics_receipts(user_id)
  select id from auth.users where id = auth.uid()
    and email_confirmed_at is not null and not coalesce(is_anonymous, false)
  on conflict (user_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end $$;
revoke all on function public.claim_signup_analytics() from public, anon;
grant execute on function public.claim_signup_analytics() to authenticated;
commit;
