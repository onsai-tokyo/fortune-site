begin;
-- Annual subscriptions release five credits per anchored month, never 60 usable at once.
create or replace function public.ai_book_apply_subscription(p_user uuid,p_environment text,tx jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public set timezone='UTC' as $$
declare
 t text:=tx->>'transactionId'; annual boolean:=tx->>'productId'='com.onsai.fatelab.premium.annual';
 v_revoked boolean:=tx->>'revokedMs' is not null or coalesce((tx->>'isUpgraded')::boolean,false);
 signed bigint:=(tx->>'signedMs')::bigint;
 anchor timestamptz:=to_timestamp((tx->>'purchaseMs')::bigint/1000.0);
 expiry timestamptz:=to_timestamp((tx->>'expiresMs')::bigint/1000.0);
 start_at timestamptz; end_at timestamptz; key text; g public.ai_book_grants; i integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-book-owner:'||p_user::text,0));
 -- Transfer existing slots only after the verified Sandbox lineage has moved.
 -- Consumption stays attached to each slot; a restore never replenishes usage.
 if p_environment='Sandbox' and not v_revoked and expiry>now() and exists(
   select 1 from public.app_store_lineages l join public.app_store_subscriptions s
     on s.user_id=l.user_id and s.environment=l.environment and s.original_transaction_id=l.original_transaction_id
   where l.environment='Sandbox' and l.user_id=p_user and l.latest_transaction_id=t and l.payload=tx
     and s.latest_transaction_id=t and s.subscription_status='active' and s.revoked_at is null and s.expires_at>now()
 ) then
   update public.ai_book_grants set user_id=p_user,revoked=false
   where environment='Sandbox' and source='member' and user_id<>p_user and signed_ms<=signed
     and (transaction_id=t or transaction_id like t||':annual:%');
 end if;
 -- A delayed old transaction cannot reintroduce credits after a plan switch.
 if exists(select 1 from public.app_store_lineages where user_id=p_user and environment=p_environment
   and original_transaction_id=tx->>'originalTransactionId' and purchase_ms>(tx->>'purchaseMs')::bigint) then
   v_revoked:=true;
 end if;
 -- The verified current projection supersedes overlapping member grants immediately,
 -- without waiting for Apple's separate upgraded-transaction notification.
 if not v_revoked and exists(select 1 from public.app_store_subscriptions where user_id=p_user
   and environment=p_environment and latest_transaction_id=t and subscription_status='active') then
   update public.ai_book_grants set revoked=true where user_id=p_user and source='member'
     and expires_at>anchor and transaction_id<>t and split_part(transaction_id,':annual:',1)<>t;
 end if;

 if not annual then
   if exists(select 1 from public.ai_book_grants where environment=p_environment and transaction_id=t and user_id<>p_user) then
     update public.ai_book_grants set revoked=true where environment=p_environment and transaction_id=t; return;
   end if;
   if not (select enabled from public.ai_book_settings where id) and not v_revoked
     and not exists(select 1 from public.ai_book_grants where environment=p_environment and transaction_id=t) then return; end if;
   perform public.ai_book_grant(p_user,p_environment,t,'member',anchor,expiry,v_revoked,signed);
   return;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('ai-book-annual:'||p_environment||':'||t,0));
 for i in 0..11 loop
   key:=t||':annual:'||i;
   -- Sandbox renewals are accelerated. Divide the verified short period into 12 test months.
   if p_environment='Sandbox' and expiry-anchor<interval '28 days' then
     start_at:=anchor+(expiry-anchor)*(i/12.0); end_at:=anchor+(expiry-anchor)*((i+1)/12.0);
   else
     start_at:=anchor+make_interval(months=>i); end_at:=least(anchor+make_interval(months=>i+1),expiry);
   end if;
   if start_at>=expiry then continue; end if;
   select * into g from public.ai_book_grants where environment=p_environment and transaction_id=key for update;
   if found then
     if g.user_id<>p_user then
       update public.ai_book_grants set revoked=true where id=g.id;
     elsif signed>=g.signed_ms then
       update public.ai_book_grants set revoked=g.revoked or v_revoked,signed_ms=signed where id=g.id;
     end if;
   elsif (select enabled from public.ai_book_settings where id) or v_revoked then
     insert into public.ai_book_grants(user_id,environment,transaction_id,source,quantity,starts_at,expires_at,revoked,signed_ms)
       values(p_user,p_environment,key,'member',5,start_at,end_at,v_revoked,signed) returning * into g;
     insert into public.ai_book_credits(grant_id,slot) select g.id,generate_series(1,5);
   end if;
 end loop;
end $$;
commit;
