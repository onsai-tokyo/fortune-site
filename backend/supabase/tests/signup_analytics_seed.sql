-- Disposable local database only; creates a minimal Supabase-compatible Auth schema.
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key, email_confirmed_at timestamptz, is_anonymous boolean default false);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
insert into auth.users values
 ('00000000-0000-4000-8000-000000000001', now(), false),
 ('00000000-0000-4000-8000-000000000002', null, false),
 ('00000000-0000-4000-8000-000000000003', now(), true),
 ('00000000-0000-4000-8000-000000000004', null, true);
