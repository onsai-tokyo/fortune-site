begin;
create or replace function public.ai_book_subscription_event() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare tx jsonb; owner uuid;
begin
  if new.state<>'applied' or new.result->>'delivery'<>'mirrored' then return new; end if;
  tx:=new.payload->'transaction'; owner:=(new.result->>'ownerId')::uuid;
  if exists(select 1 from public.ai_book_grants where environment=new.environment and transaction_id=tx->>'transactionId' and user_id<>owner) then
    update public.ai_book_grants set revoked=true where environment=new.environment and transaction_id=tx->>'transactionId';
    return new;
  end if;
  -- Pausing new orders must not pause refund/ownership reconciliation.
  -- Preserve a revoked tombstone even if this period was never granted while off.
  if not (select enabled from public.ai_book_settings where id)
    and tx->>'revokedMs' is null and not coalesce((tx->>'isUpgraded')::boolean,false)
    and not exists(select 1 from public.ai_book_grants where environment=new.environment and transaction_id=tx->>'transactionId') then
    return new;
  end if;
  perform public.ai_book_grant(owner,new.environment,tx->>'transactionId','member',
    to_timestamp((tx->>'purchaseMs')::bigint/1000.0),to_timestamp((tx->>'expiresMs')::bigint/1000.0),
    tx->>'revokedMs' is not null or coalesce((tx->>'isUpgraded')::boolean,false),(tx->>'signedMs')::bigint);
  return new;
end $$;
commit;
