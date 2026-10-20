-- NEW WEB ONLY. Apply only after separate production approval.
-- Old reading_saves rows and iOS APIs are deliberately unchanged.
begin;
create table public.web_reading_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.reading_conversations(id) on delete set null,
  partner_id uuid references public.partner_profiles(id) on delete cascade,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 200000),
  created_at timestamptz not null default now(),
  unique(user_id, content_hash)
);
alter table public.web_reading_snapshots enable row level security;
revoke all on public.web_reading_snapshots from public,anon,authenticated;
grant select, insert, delete on public.web_reading_snapshots to authenticated;
revoke update on public.web_reading_snapshots from authenticated, anon;
grant all on public.web_reading_snapshots to service_role;
create policy snapshot_read on public.web_reading_snapshots for select to authenticated using (user_id = auth.uid());
create policy snapshot_delete on public.web_reading_snapshots for delete to authenticated using (user_id = auth.uid());
-- Existing source tables need not grant authenticated SELECT. This narrow
-- predicate checks only the caller's ownership, never returns source content.
create function public.web_snapshot_source_owned(p_source uuid, p_partner uuid)
returns boolean language sql stable security definer set search_path = pg_catalog,public
as $$
  select auth.uid() is not null
    and exists(select 1 from public.reading_conversations c where c.id=p_source and c.user_id=auth.uid())
    and (p_partner is null or exists(select 1 from public.partner_profiles p where p.id=p_partner and p.user_id=auth.uid()));
$$;
revoke all on function public.web_snapshot_source_owned(uuid,uuid) from public,anon;
grant execute on function public.web_snapshot_source_owned(uuid,uuid) to authenticated;
create policy snapshot_insert on public.web_reading_snapshots for insert to authenticated with check (
  user_id = auth.uid()
  and coalesce((auth.jwt()->>'is_anonymous')::boolean, true) = false
  and public.web_snapshot_source_owned(source_id,partner_id)
);
commit;
