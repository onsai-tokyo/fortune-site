begin;
create table if not exists public.timeline_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 birth_data jsonb not null,
 relationship_status text check (relationship_status in ('partnered','single','married')),
 updated_at timestamptz not null default now()
);
create table if not exists public.life_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.timeline_profiles(user_id) on delete cascade,
 year int not null check(year between 1900 and 2100), month int check(month between 1 and 12),
 kind text not null check(kind in ('encounter','start','reunion','marriage','breakup','divorce','job','study','move','other')),
 created_at timestamptz not null default now()
);
create index if not exists life_events_owner on public.life_events(user_id);
create table if not exists public.validation_consents (
 user_id uuid primary key references auth.users(id) on delete cascade,
 consented_at timestamptz, withdrawn_at timestamptz, policy_version text not null default 'timeline-v1'
);
alter table public.timeline_profiles enable row level security;
alter table public.life_events enable row level security;
alter table public.validation_consents enable row level security;
create policy timeline_profile_owner on public.timeline_profiles for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy life_event_owner on public.life_events for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy validation_consent_owner on public.validation_consents for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
grant select,insert,update,delete on public.timeline_profiles,public.life_events,public.validation_consents to authenticated;
-- Replace atomically: failures leave the previous list intact. Actor comes from the JWT.
create or replace function public.replace_life_events(p_events jsonb) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare owner_id uuid:=auth.uid(); profile public.timeline_profiles; e jsonb; birth_year int;
begin
 if owner_id is null then raise exception 'UNAUTHENTICATED'; end if;
 select * into profile from public.timeline_profiles where user_id=owner_id for update;
 if not found then raise exception 'PROFILE_REQUIRED'; end if;
 birth_year:=substring(profile.birth_data->>'birthDate',1,4)::int;
 if p_events is null or jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>100 then raise exception 'INVALID_EVENTS'; end if;
 for e in select value from jsonb_array_elements(p_events) loop
   if (e->>'year')::int < birth_year or (e->>'year')::int > extract(year from current_timestamp at time zone 'Asia/Tokyo') then raise exception 'INVALID_EVENT_YEAR'; end if;
 end loop;
 delete from public.life_events where user_id=owner_id;
 insert into public.life_events(user_id,year,month,kind) select owner_id,(item.value->>'year')::int,(item.value->>'month')::int,item.value->>'kind' from jsonb_array_elements(p_events) as item(value);
end $$;
revoke all on function public.replace_life_events(jsonb) from public,anon;
grant execute on function public.replace_life_events(jsonb) to authenticated;
-- The profile row is the serialization lock for profile edits and event writes.
create or replace function public.guard_timeline_profile() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if (old.birth_data - 'relationshipStatus' - 'workContext') is distinct from (new.birth_data - 'relationshipStatus' - 'workContext')
 and exists(select 1 from public.life_events where user_id=old.user_id) then
   raise exception 'TIMELINE_PROFILE_HAS_EVENTS';
 end if;
 return new;
end $$;
create trigger timeline_profile_guard before update on public.timeline_profiles
for each row execute function public.guard_timeline_profile();
create or replace function public.guard_life_event() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare birth_year int;
begin
 select substring(birth_data->>'birthDate',1,4)::int into birth_year
 from public.timeline_profiles where user_id=new.user_id for update;
 if not found or new.year < birth_year or new.year > extract(year from current_timestamp at time zone 'Asia/Tokyo') then
  raise exception 'INVALID_EVENT_YEAR';
 end if;
 if (select count(*) from public.life_events where user_id=new.user_id and id<>new.id)>=100 then
  raise exception 'TOO_MANY_EVENTS';
 end if;
 return new;
end $$;
create trigger life_event_guard before insert or update on public.life_events
for each row execute function public.guard_life_event();
commit;
