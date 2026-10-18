begin;

-- Keep the existing entitlement projection and legacy notification history intact.
-- Transaction IDs belong to their environment; retain uniqueness within it.
alter table public.app_store_subscriptions drop constraint if exists app_store_subscriptions_original_transaction_id_key;
alter table public.app_store_subscriptions add constraint app_store_subscriptions_environment_original_key unique(environment,original_transaction_id);
create table public.app_store_event_journal (
  sequence_id bigint generated always as identity unique,
  environment text not null check (environment in ('Sandbox', 'Production')),
  event_id text not null check (length(event_id) between 1 and 200),
  payload jsonb not null,
  state text not null default 'received' check (state in ('received','failed','applied','ignored')),
  attempts integer not null default 0,
  last_error text,
  result jsonb,
  received_at timestamptz not null default now(),
  applied_at timestamptz,
  primary key (environment,event_id)
);
create table public.app_store_lineages (
  environment text not null check (environment in ('Sandbox','Production')),
  original_transaction_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  latest_transaction_id text not null,
  purchase_ms bigint,
  signed_ms bigint,
  payload jsonb,
  legacy_projection jsonb,
  ownership_sequence bigint not null default 0,
  primary key (environment,original_transaction_id)
);
create index app_store_lineages_owner_idx on public.app_store_lineages(user_id,environment,purchase_ms);
create index app_store_event_pending_idx on public.app_store_event_journal(sequence_id) where state in ('received','failed');
-- Unknown ordering remains NULL: no fabricated signed/purchase dates for old rows.
insert into public.app_store_lineages(environment,original_transaction_id,user_id,latest_transaction_id,legacy_projection)
select environment,original_transaction_id,user_id,latest_transaction_id,to_jsonb(app_store_subscriptions)
from public.app_store_subscriptions where environment in ('Sandbox','Production');

alter table public.app_store_event_journal enable row level security;
alter table public.app_store_lineages enable row level security;
revoke all on public.app_store_event_journal, public.app_store_lineages from public, anon, authenticated, service_role;

create function public.app_store_receive_event(p_environment text, p_event_id text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare row public.app_store_event_journal;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_payload->>'environment' is distinct from p_environment then
    raise exception 'invalid_event';
  end if;
  insert into public.app_store_event_journal(environment,event_id,payload)
  values(p_environment,p_event_id,p_payload) on conflict do nothing;
  select * into strict row from public.app_store_event_journal
    where environment=p_environment and event_id=p_event_id for update;
  if row.payload is distinct from p_payload then raise exception 'event_identity_conflict'; end if;
  return jsonb_build_object('state',row.state);
end $$;

-- Called only while holding the global Apple writer lock. This makes owner
-- transfer, lineage selection, projection and journal completion one transaction.
create function public.app_store_refresh_projection(p_user uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare chosen public.app_store_lineages; body jsonb; projected_status text;
begin
  -- A legacy lineage must be reconciled with its exact latest transaction first.
  if exists(select 1 from public.app_store_lineages where user_id=p_user and payload is null) then
    raise exception 'legacy_reconciliation_required';
  end if;
  -- Equal purchase dates on different lineages cannot be ordered by expiry/ID.
  if exists(select 1 from public.app_store_lineages where user_id=p_user
      group by environment,purchase_ms having count(*)>1) then raise exception 'ambiguous_lineage_order'; end if;
  select * into chosen from public.app_store_lineages where user_id=p_user
    order by (environment='Production') desc,purchase_ms desc limit 1;
  if not found then
    delete from public.app_store_subscriptions where user_id=p_user;
    return;
  end if;
  body := chosen.payload;
  projected_status := case when body->>'revokedMs' is not null then 'revoked'
    when coalesce((body->>'isUpgraded')::boolean,false) then 'expired'
    when (body->>'expiresMs')::bigint <= extract(epoch from now())*1000 then 'expired' else 'active' end;
  insert into public.app_store_subscriptions(user_id,original_transaction_id,latest_transaction_id,product_id,
    environment,subscription_status,expires_at,revoked_at,app_account_token,updated_at)
  values(p_user,chosen.original_transaction_id,chosen.latest_transaction_id,body->>'productId',chosen.environment,
    projected_status,to_timestamp((body->>'expiresMs')::bigint/1000.0),
    to_timestamp((body->>'revokedMs')::bigint/1000.0),p_user,now())
  on conflict(user_id) do update set original_transaction_id=excluded.original_transaction_id,
    latest_transaction_id=excluded.latest_transaction_id,product_id=excluded.product_id,environment=excluded.environment,
    subscription_status=excluded.subscription_status,expires_at=excluded.expires_at,revoked_at=excluded.revoked_at,
    app_account_token=excluded.app_account_token,updated_at=excluded.updated_at;
end $$;

create function public.app_store_apply_event(p_environment text,p_event_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare ev public.app_store_event_journal; line public.app_store_lineages; tx jsonb;
  requested uuid; token_owner uuid; owner uuid; old_owner uuid;
  transfer boolean; newer boolean; answer jsonb; failure text;
begin
  -- A deliberately coarse lock avoids crossed-user transfer deadlocks. It covers
  -- every writer, including replay workers. No external IO occurs while held.
  perform pg_advisory_xact_lock(741204,2);
  select * into strict ev from public.app_store_event_journal
    where environment=p_environment and event_id=p_event_id for update;
  tx := ev.payload->'transaction';
  requested := (ev.payload->>'requestUserId')::uuid;
  if ev.state in ('applied','ignored') then
    -- An old successful transfer acknowledgement must not claim the old owner
    -- still owns the purchase after a later transfer.
    if requested is not null and exists(select 1 from public.app_store_lineages
      where environment=p_environment and original_transaction_id=tx->>'originalTransactionId' and user_id<>requested) then
      return jsonb_build_object('state','applied','delivery','owner_mismatch');
    end if;
    return ev.result;
  end if;
  update public.app_store_event_journal set attempts=attempts+1 where environment=p_environment and event_id=p_event_id;
  begin
    if ev.payload->>'action' = 'ignore' then
      answer := jsonb_build_object('state','ignored','delivery','no_entitlement_change');
    else
      if ev.payload->>'action' is distinct from 'transaction' then raise exception 'unsupported_notification'; end if;
      if tx->>'environment' is distinct from p_environment or
        nullif(tx->>'transactionId','') is null or nullif(tx->>'originalTransactionId','') is null or
        nullif(tx->>'productId','') is null or
        coalesce((tx->>'purchaseMs')::bigint,0)<=0 or coalesce((tx->>'signedMs')::bigint,0)<=0 or
        coalesce((tx->>'expiresMs')::bigint,0)<=0 then raise exception 'invalid_transaction'; end if;
      token_owner := (tx->>'appAccountToken')::uuid;
      select * into line from public.app_store_lineages
        where environment=p_environment and original_transaction_id=tx->>'originalTransactionId';
      old_owner := line.user_id;
      if old_owner is null and token_owner is null then raise exception 'owner_unresolved'; end if;
      -- Notifications follow the stored owner after an explicit sandbox transfer.
      owner := coalesce(requested,old_owner,token_owner);
      if owner is null then raise exception 'owner_unresolved'; end if;
      transfer := p_environment='Sandbox' and coalesce((ev.payload->>'allowOwnerTransfer')::boolean,false);
      if requested is not null and ((token_owner is not null and token_owner<>requested and not transfer)
          or (old_owner is not null and old_owner<>requested and not transfer)
          or (old_owner is not null and old_owner<>requested and ev.sequence_id<=line.ownership_sequence)) then
        answer := jsonb_build_object('state','applied','delivery','owner_mismatch');
      else
        -- No sandbox writer may replace or transfer any production ownership.
        if p_environment='Sandbox' and (
          exists(select 1 from public.app_store_lineages where environment='Production' and (user_id=owner or original_transaction_id=tx->>'originalTransactionId')) or
          exists(select 1 from public.app_store_subscriptions where environment='Production' and user_id=owner)) then
          raise exception 'sandbox_production_conflict';
        end if;
        if exists(select 1 from public.app_store_subscriptions where user_id=owner and environment not in ('Production','Sandbox')) then
          raise exception 'legacy_environment_unresolved';
        end if;
        newer := true;
        if old_owner is not null then
          if line.payload is null and line.latest_transaction_id<>tx->>'transactionId' then
            raise exception 'legacy_reconciliation_required';
          elsif line.payload is null and (
              (line.legacy_projection->>'product_id') is distinct from tx->>'productId' or
              (line.legacy_projection->>'expires_at')::timestamptz is distinct from to_timestamp((tx->>'expiresMs')::bigint/1000.0) or
              (line.legacy_projection->>'revoked_at')::timestamptz is distinct from to_timestamp((tx->>'revokedMs')::bigint/1000.0)) then
            raise exception 'legacy_reconciliation_required';
          elsif line.payload is not null then
            if line.latest_transaction_id=tx->>'transactionId' then
              if line.purchase_ms<>(tx->>'purchaseMs')::bigint then raise exception 'transaction_identity_conflict'; end if;
              if line.signed_ms=(tx->>'signedMs')::bigint and line.payload is distinct from tx then raise exception 'signed_version_conflict'; end if;
              newer := (tx->>'signedMs')::bigint>line.signed_ms;
            else
              if line.purchase_ms=(tx->>'purchaseMs')::bigint then raise exception 'ambiguous_transaction_order'; end if;
              newer := (tx->>'purchaseMs')::bigint>line.purchase_ms;
            end if;
          end if;
        end if;
        if old_owner is null then
          insert into public.app_store_lineages(environment,original_transaction_id,user_id,latest_transaction_id,
            purchase_ms,signed_ms,payload,ownership_sequence)
          values(p_environment,tx->>'originalTransactionId',owner,tx->>'transactionId',
            (tx->>'purchaseMs')::bigint,(tx->>'signedMs')::bigint,tx,ev.sequence_id);
        else
          update public.app_store_lineages set user_id=owner,
            ownership_sequence=case when old_owner<>owner then ev.sequence_id else ownership_sequence end,
            latest_transaction_id=case when newer then tx->>'transactionId' else latest_transaction_id end,
            purchase_ms=case when newer then (tx->>'purchaseMs')::bigint else purchase_ms end,
            signed_ms=case when newer then (tx->>'signedMs')::bigint else signed_ms end,
            payload=case when newer then tx else payload end
          where environment=p_environment and original_transaction_id=tx->>'originalTransactionId';
        end if;
        if old_owner is not null and old_owner<>owner then perform public.app_store_refresh_projection(old_owner); end if;
        perform public.app_store_refresh_projection(owner);
        answer := jsonb_build_object('state','applied','delivery','mirrored','ownerId',owner,'transactionId',tx->>'transactionId');
      end if;
    end if;
    update public.app_store_event_journal set state=answer->>'state',result=answer,last_error=null,applied_at=now()
      where environment=p_environment and event_id=p_event_id;
    return answer;
  exception when others then
    -- The subtransaction rolls back ALL mirror/owner writes. Keep the receipt and
    -- failed attempt outside it, so retries cannot be mistaken for duplicates.
    failure := case when sqlstate='P0001' then sqlerrm else sqlstate end;
    update public.app_store_event_journal set state='failed',last_error=failure
      where environment=p_environment and event_id=p_event_id;
    return jsonb_build_object('state','pending','reason',failure);
  end;
end $$;

revoke all on function public.app_store_receive_event(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.app_store_apply_event(text,text) from public,anon,authenticated;
revoke all on function public.app_store_refresh_projection(uuid) from public,anon,authenticated,service_role;
grant execute on function public.app_store_receive_event(text,text,jsonb), public.app_store_apply_event(text,text) to service_role;
grant select on public.app_store_event_journal to service_role;
-- Retire direct service-role mirror writers; the SECURITY DEFINER RPC owns writes.
revoke insert,update,delete on public.app_store_subscriptions from public,anon,authenticated,service_role;
grant select on public.app_store_subscriptions to service_role;
commit;
