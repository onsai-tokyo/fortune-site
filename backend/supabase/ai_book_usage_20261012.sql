begin;
-- Append-only request observations survive metadata replacement and retries.
create table public.ai_book_usage_events (
 book_id uuid not null references public.ai_books(id) on delete cascade,
 lease_id uuid not null, attempt integer not null check(attempt between 1 and 3),
 call_index integer not null check(call_index between 0 and 3),
 phase text not null check(phase in ('started','response','error','attempt_succeeded','attempt_failed')),
 model text not null, prompt_version text not null, provider_model text,
 input_tokens bigint check(input_tokens>=0), output_tokens bigint check(output_tokens>=0),
 cache_creation_input_tokens bigint check(cache_creation_input_tokens>=0), cache_read_input_tokens bigint check(cache_read_input_tokens>=0),
 failure_code text, created_at timestamptz not null default now(),
 primary key(book_id,lease_id,call_index,phase)
);
alter table public.ai_book_usage_events enable row level security;
revoke all on public.ai_book_usage_events from public,anon,authenticated,service_role;
grant select,insert on public.ai_book_usage_events to service_role;
commit;
