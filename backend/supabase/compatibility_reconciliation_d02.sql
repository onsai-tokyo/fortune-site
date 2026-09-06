-- After compatibility_operations_d02.sql. Operator-only, never scheduled by this migration.
begin;
create index compatibility_expired_pending_idx on public.compatibility_operations(lease_until,user_id,op_id) where state='pending';
create function public.reconcile_compatibility_operations(p_apply boolean default false,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare cutoff timestamptz:=statement_timestamp(); candidates jsonb; item jsonb; outcome jsonb;
 examined integer:=0; refunded_points integer:=0; has_more boolean;
begin
 if p_apply is null or p_limit is null or p_limit<1 or p_limit>100 then raise exception 'invalid_reconciliation_options'; end if;
 if not p_apply then
   -- A real read-only preview: no calls to status RPCs, which can reconcile leases.
   select coalesce(jsonb_agg(jsonb_build_object('cost',reserved_cost,'refunded',refunded)),'[]'::jsonb) into candidates
   from (select reserved_cost,refunded from public.compatibility_operations where state='pending' and lease_until<=cutoff
     order by lease_until,user_id,op_id limit p_limit+1) planned;
   has_more:=jsonb_array_length(candidates)>p_limit;
   for item in select value from jsonb_array_elements(candidates) limit p_limit loop
     examined:=examined+1;
     if not (item->>'refunded')::boolean then refunded_points:=refunded_points+(item->>'cost')::integer; end if;
   end loop;
   return jsonb_build_object('mode','dry_run','examined',examined,'wouldRefundPoints',refunded_points,'reconciled',0,'refundedPoints',0,'hasMore',has_more,'busy',false);
 end if;
 -- One operator sweep at a time. Public completion/status requests continue normally.
 if not pg_try_advisory_xact_lock(hashtextextended('compatibility-reconciliation',0)) then
   return jsonb_build_object('mode','apply','examined',0,'wouldRefundPoints',0,'reconciled',0,'refundedPoints',0,'hasMore',true,'busy',true);
 end if;
 -- Materialize and lock the entire bounded set BEFORE any balance locks.
 -- A worker already holding an operation is skipped; this avoids lock cycles with workers.
 select coalesce(jsonb_agg(jsonb_build_object('user',user_id,'op',op_id,'cost',reserved_cost,'refunded',refunded)),'[]'::jsonb) into candidates
 from (select user_id,op_id,reserved_cost,refunded from public.compatibility_operations where state='pending' and lease_until<=cutoff
   order by lease_until,user_id,op_id limit p_limit for update skip locked) locked;
 for item in select value from jsonb_array_elements(candidates) loop
   outcome:=public.read_compatibility_operation((item->>'user')::uuid,(item->>'op')::uuid);
   if outcome->>'state' is distinct from 'failed' then raise exception 'reconciliation_not_acknowledged'; end if;
   examined:=examined+1;
   if not (item->>'refunded')::boolean then refunded_points:=refunded_points+(item->>'cost')::integer; end if;
 end loop;
 select exists(select 1 from public.compatibility_operations where state='pending' and lease_until<=cutoff) into has_more;
 return jsonb_build_object('mode','apply','examined',examined,'wouldRefundPoints',0,'reconciled',examined,'refundedPoints',refunded_points,'hasMore',has_more,'busy',false);
 -- Any failure rolls back the whole batch, including balance changes. No partial acknowledgement.
end $$;
revoke all on function public.reconcile_compatibility_operations(boolean,integer) from public,anon,authenticated;
grant execute on function public.reconcile_compatibility_operations(boolean,integer) to service_role;
commit;
