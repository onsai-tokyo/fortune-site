-- HISTORICAL MIGRATION — ALREADY APPLIED IN PRODUCTION.
-- Do not re-run this file against an existing production or staging database.
-- It creates the one-time trial secret and must be used only when creating a
-- new staging database from the initial schema.
-- Apply before deploying the books-only pricing API. No existing purchases are changed.
begin;
alter table public.ai_book_grants drop constraint ai_book_grants_source_check;
alter table public.ai_book_grants add constraint ai_book_grants_source_check check (
 source in ('member','purchase') or
 (source='review' and environment='Sandbox' and signed_ms=0 and transaction_id like 'admin-review:%') or
 (source='trial' and environment='Production' and signed_ms=0 and quantity=1 and transaction_id like 'trial:%')
);
-- A purpose-specific secret prevents dictionary lookup of the email fingerprint.
-- Fingerprints survive account deletion solely to prevent repeated free grants.
create table public.ai_book_trial_secret (id boolean primary key check(id), secret text not null);
insert into public.ai_book_trial_secret values(true,gen_random_uuid()::text||gen_random_uuid()::text);
create table public.ai_book_trial_claims (fingerprint text primary key, created_at timestamptz not null default now());
alter table public.ai_book_trial_secret enable row level security;
alter table public.ai_book_trial_claims enable row level security;
revoke all on public.ai_book_trial_secret,public.ai_book_trial_claims from public,anon,authenticated,service_role;

create function public.ai_book_sync_trial(p_user uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare identity text; fingerprint text; inserted integer; grant_id uuid;
begin
 if not (select enabled from public.ai_book_settings where id) then return; end if;
 select lower(trim(email)) into identity from auth.users where id=p_user and email_confirmed_at is not null;
 if identity is null or identity='' then return; end if;
 select encode(sha256(convert_to(secret||':'||identity,'UTF8')),'hex') into fingerprint from public.ai_book_trial_secret where id;
 insert into public.ai_book_trial_claims values(fingerprint,now()) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return; end if;
 insert into public.ai_book_grants(user_id,environment,transaction_id,source,quantity,starts_at,expires_at,revoked,signed_ms)
 values(p_user,'Production','trial:'||fingerprint,'trial',1,now(),null,false,0) returning id into grant_id;
 insert into public.ai_book_credits(grant_id,slot) values(grant_id,1);
end $$;
revoke all on function public.ai_book_sync_trial(uuid) from public,anon,authenticated;
grant execute on function public.ai_book_sync_trial(uuid) to service_role;
commit;
