create table if not exists public.ai_chat_monthly_user_usage (
  usage_month date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_count integer not null default 0 check (question_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (usage_month, user_id)
);

create table if not exists public.ai_chat_monthly_global_usage (
  usage_month date primary key,
  question_count integer not null default 0 check (question_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ai_chat_monthly_user_usage enable row level security;
alter table public.ai_chat_monthly_global_usage enable row level security;
revoke all on public.ai_chat_monthly_user_usage from anon, authenticated;
revoke all on public.ai_chat_monthly_global_usage from anon, authenticated;

create or replace function public.reserve_ai_chat_question(
  target_user_id uuid,
  user_question_limit integer,
  global_question_limit integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_month date := date_trunc('month', timezone('Asia/Tokyo', now()))::date;
  reserved integer;
begin
  if global_question_limit <= 0 then return 'global_limit'; end if;
  if user_question_limit <= 0 then return 'user_limit'; end if;

  insert into public.ai_chat_monthly_global_usage (usage_month, question_count, updated_at)
  values (current_month, 1, now())
  on conflict (usage_month) do update
    set question_count = public.ai_chat_monthly_global_usage.question_count + 1,
        updated_at = now()
    where public.ai_chat_monthly_global_usage.question_count < global_question_limit
  returning question_count into reserved;
  if reserved is null then return 'global_limit'; end if;

  reserved := null;
  insert into public.ai_chat_monthly_user_usage (usage_month, user_id, question_count, updated_at)
  values (current_month, target_user_id, 1, now())
  on conflict (usage_month, user_id) do update
    set question_count = public.ai_chat_monthly_user_usage.question_count + 1,
        updated_at = now()
    where public.ai_chat_monthly_user_usage.question_count < user_question_limit
  returning question_count into reserved;

  if reserved is null then
    update public.ai_chat_monthly_global_usage
      set question_count = greatest(0, question_count - 1), updated_at = now()
      where usage_month = current_month;
    return 'user_limit';
  end if;
  return 'ok';
end;
$$;

create or replace function public.refund_ai_chat_question(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_month date := date_trunc('month', timezone('Asia/Tokyo', now()))::date;
begin
  update public.ai_chat_monthly_user_usage
    set question_count = greatest(0, question_count - 1), updated_at = now()
    where usage_month = current_month and user_id = target_user_id;
  update public.ai_chat_monthly_global_usage
    set question_count = greatest(0, question_count - 1), updated_at = now()
    where usage_month = current_month;
end;
$$;

revoke all on function public.reserve_ai_chat_question(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.refund_ai_chat_question(uuid) from public, anon, authenticated;
grant execute on function public.reserve_ai_chat_question(uuid, integer, integer) to service_role;
grant execute on function public.refund_ai_chat_question(uuid) to service_role;
