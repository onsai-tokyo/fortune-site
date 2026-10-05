begin;
-- Separate from AI consultation-book credits. Service-only, immutable target binding.
create table public.reading_card_purchases (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 environment text not null check(environment in ('Sandbox','Production')), transaction_id text not null,
 purchased_at timestamptz not null, signed_ms bigint not null check(signed_ms>0), revoked boolean not null default false,
 target_key text, offer_key text, consumed_at timestamptz,
 unique(environment,transaction_id),
 check((target_key is null and offer_key is null and consumed_at is null) or
       (target_key ~ '^[a-f0-9]{64}$' and offer_key is not null and consumed_at is not null))
);
create index reading_card_purchases_owner on public.reading_card_purchases(user_id,target_key,offer_key);
alter table public.reading_card_purchases enable row level security;
revoke all on public.reading_card_purchases from public,anon,authenticated;
grant select on public.reading_card_purchases to service_role;

create function public.reading_card_grant(p_user uuid,p_environment text,p_transaction text,p_purchased timestamptz,p_signed bigint,p_revoked boolean)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare g public.reading_card_purchases;
begin
 perform pg_advisory_xact_lock(hashtextextended('reading-card-user:'||p_user,0));
 perform pg_advisory_xact_lock(hashtextextended('reading-card-tx:'||p_environment||':'||p_transaction,0));
 select * into g from public.reading_card_purchases where environment=p_environment and transaction_id=p_transaction for update;
 if found then
  if g.user_id<>p_user then raise exception 'READING_CARD_OWNER_MISMATCH'; end if;
  -- Revocation is sticky even when a newer unrevoked receipt was already seen.
  update public.reading_card_purchases set revoked=revoked or p_revoked,signed_ms=greatest(signed_ms,p_signed) where id=g.id;
 else
  insert into public.reading_card_purchases(user_id,environment,transaction_id,purchased_at,signed_ms,revoked)
    values(p_user,p_environment,p_transaction,p_purchased,p_signed,p_revoked);
 end if;
end $$;

create function public.reading_card_unlock(p_user uuid,p_environment text,p_target text,p_offer text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare credit uuid;
begin
 if p_target is null or p_target !~ '^[a-f0-9]{64}$' or p_offer is null or
    p_offer !~ '^(compatibility:compat-v24-[567]|(self|couple):year:[0-9]{4})$' then raise exception 'READING_CARD_TARGET_INVALID'; end if;
 if p_offer like '%:year:%' and right(p_offer,4)::int<2027 then raise exception 'READING_CARD_TARGET_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended('reading-card-user:'||p_user,0));
 if exists(select 1 from public.reading_card_purchases where user_id=p_user and environment=p_environment and target_key=p_target and offer_key=p_offer and not revoked) then return; end if;
 select id into credit from public.reading_card_purchases where user_id=p_user and environment=p_environment and not revoked and target_key is null
   order by purchased_at,id limit 1 for update;
 if credit is null then raise exception 'READING_CARD_NO_CREDIT'; end if;
 update public.reading_card_purchases set target_key=p_target,offer_key=p_offer,consumed_at=now() where id=credit;
end $$;
revoke all on function public.reading_card_grant(uuid,text,text,timestamptz,bigint,boolean),public.reading_card_unlock(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reading_card_grant(uuid,text,text,timestamptz,bigint,boolean),public.reading_card_unlock(uuid,text,text,text) to service_role;
-- The generation journal remains service-only. Read just the owner's input to
-- apply the same target key to initial delivery and uncertain-operation retries.
create function public.reading_card_generation_input(p_user uuid,p_operation uuid)
returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select request_payload->'body' from public.self_generation_operations where user_id=p_user and op_id=p_operation;
$$;
revoke all on function public.reading_card_generation_input(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reading_card_generation_input(uuid,uuid) to service_role;
commit;
