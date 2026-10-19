-- Synthetic fixture only, not a representation of the production schema.
begin;
create table public.ai_book_grants (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),
 environment text not null, transaction_id text not null, source text not null,
 quantity integer not null, starts_at timestamptz not null default now(), expires_at timestamptz,
 revoked boolean not null default false, signed_ms bigint not null, created_at timestamptz default now(),
 constraint ai_book_grants_environment_check check(environment in ('Production','Sandbox','Review','Trial')),
 constraint ai_book_grants_source_check check (
  source in ('member','purchase') or
  (source='review' and environment='Review' and signed_ms=0 and transaction_id like 'review:%') or
  (source='trial' and environment='Trial' and quantity=1 and signed_ms=0 and transaction_id like 'trial:%'))
);
create table public.ai_books (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),
 operation_id uuid, source_id uuid, target_title text, theme text, question text,
 source_snapshot jsonb, funding_source text, state text
);
create table public.ai_book_credits (
 id uuid primary key default gen_random_uuid(), grant_id uuid references public.ai_book_grants(id),
 slot integer, consumed_by uuid references public.ai_books(id), recovery_until timestamptz
);
create table public.partner_profiles (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id)
);
create function public.ai_book_question_begin(uuid,uuid,uuid,text)
 returns jsonb language sql as $$ select '{}'::jsonb $$;
comment on function public.ai_book_question_begin(uuid,uuid,uuid,text) is 'synthetic original 4-argument function';
commit;
