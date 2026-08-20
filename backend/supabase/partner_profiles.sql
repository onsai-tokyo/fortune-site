create table if not exists public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  birth_date date not null,
  birth_time time,
  birthplace text not null,
  gender text not null check (gender in ('male', 'female')),
  relationship_type text not null check (relationship_type in ('romantic', 'friend')),
  created_at timestamptz not null default now()
);
create index if not exists partner_profiles_user_id_idx on public.partner_profiles(user_id);
alter table public.partner_profiles enable row level security;
revoke all on public.partner_profiles from anon, authenticated;

create or replace function public.enforce_partner_profile_limit() returns trigger language plpgsql security definer as $$
begin
  if (select count(*) from public.partner_profiles where user_id = new.user_id) >= 2 then
    raise exception 'partner_profile_limit';
  end if;
  return new;
end;
$$;
drop trigger if exists partner_profile_limit_trigger on public.partner_profiles;
create trigger partner_profile_limit_trigger before insert on public.partner_profiles for each row execute function public.enforce_partner_profile_limit();
