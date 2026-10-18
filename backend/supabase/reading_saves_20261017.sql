begin;
create table if not exists public.reading_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  save_key text not null check (
    save_key ~ '^you-[0-9]{4}$' or
    save_key ~ '^chapter-[A-Za-z0-9_-]{1,120}$' or
    save_key ~ '^couple-[0-9a-fA-F-]{36}-[0-9]{4}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, save_key)
);
alter table public.reading_saves enable row level security;
grant select, insert, update, delete on public.reading_saves to authenticated;
drop policy if exists reading_saves_owner_select on public.reading_saves;
drop policy if exists reading_saves_owner_write on public.reading_saves;
create policy reading_saves_owner_select on public.reading_saves for select using (user_id = auth.uid());
create policy reading_saves_owner_write on public.reading_saves for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant all on public.reading_saves to service_role;

-- Couple save keys are denormalized text keys, so partner deletion cannot rely
-- on a foreign key. Keep the Web bookshelf consistent with partner deletion.
create or replace function public.delete_partner_reading_saves()
returns trigger language plpgsql security definer set search_path = pg_catalog,public as $$
begin
  delete from public.reading_saves
   where user_id = old.user_id
     and save_key like 'couple-' || old.id::text || '-%';
  return old;
end;
$$;
drop trigger if exists partner_profiles_delete_reading_saves on public.partner_profiles;
create trigger partner_profiles_delete_reading_saves
  after delete on public.partner_profiles
  for each row execute function public.delete_partner_reading_saves();
revoke all on function public.delete_partner_reading_saves() from public,anon,authenticated;
grant execute on function public.delete_partner_reading_saves() to service_role;
commit;
