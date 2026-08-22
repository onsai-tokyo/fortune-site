create table if not exists public.ai_daily_generation_budget (
  usage_date date primary key,
  generated_cards integer not null default 0 check (generated_cards >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ai_daily_generation_budget enable row level security;
revoke all on public.ai_daily_generation_budget from anon, authenticated;

create or replace function public.reserve_ai_card_generation(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  reserved integer;
begin
  if p_limit <= 0 then
    return false;
  end if;

  insert into public.ai_daily_generation_budget (usage_date, generated_cards, updated_at)
  values ((timezone('Asia/Tokyo', now()))::date, 1, now())
  on conflict (usage_date) do update
    set generated_cards = public.ai_daily_generation_budget.generated_cards + 1,
        updated_at = now()
    where public.ai_daily_generation_budget.generated_cards < p_limit
  returning generated_cards into reserved;

  return reserved is not null;
end;
$$;

revoke all on function public.reserve_ai_card_generation(integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_card_generation(integer) to service_role;
