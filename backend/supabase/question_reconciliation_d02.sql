-- After question_operations_d02.sql. No schedule or live execution is installed.
begin;
create index question_expired_pending_idx on public.reading_question_operations(lease_until,user_id,op_id) where state='pending';
create function public.reconcile_reading_questions(p_apply boolean default false,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare cutoff timestamptz:=statement_timestamp(); candidate record; op public.reading_question_operations;
 selected jsonb:='[]'; item jsonb; outcome jsonb; examined integer:=0; free_count integer:=0; monthly_count integer:=0; has_more boolean;
begin
 if p_apply is null or p_limit is null or p_limit<1 or p_limit>100 then raise exception 'invalid_reconciliation_options'; end if;
 if not p_apply then
   for candidate in select charged_free,reserved from public.reading_question_operations where state='pending' and lease_until<=cutoff
     order by lease_until,user_id,op_id limit p_limit+1 loop
     examined:=examined+1;
     if examined<=p_limit then
       if candidate.charged_free then free_count:=free_count+1; end if;
       if candidate.reserved then monthly_count:=monthly_count+1; end if;
     end if;
   end loop;
   return jsonb_build_object('mode','dry_run','examined',least(examined,p_limit),'wouldReleaseFree',free_count,'wouldReleaseMonthly',monthly_count,
     'reconciled',0,'releasedFree',0,'releasedMonthly',0,'hasMore',examined>p_limit,'busy',false);
 end if;
 if not pg_try_advisory_xact_lock(hashtextextended('question-reconciliation',0)) then
   return jsonb_build_object('mode','apply','examined',0,'wouldReleaseFree',0,'wouldReleaseMonthly',0,'reconciled',0,'releasedFree',0,'releasedMonthly',0,'hasMore',true,'busy',true);
 end if;
 -- Workers lock owner BEFORE operation. Never invert that order or wait on an owner.
 -- Collect every selected owner/operation lock BEFORE taking global/user usage locks.
 for candidate in select user_id,op_id from public.reading_question_operations where state='pending' and lease_until<=cutoff
   order by lease_until,user_id,op_id limit p_limit loop
   if not pg_try_advisory_xact_lock(hashtextextended('question-owner:'||candidate.user_id::text,0)) then continue; end if;
   select * into op from public.reading_question_operations where user_id=candidate.user_id and op_id=candidate.op_id
     and state='pending' and lease_until<=cutoff for update skip locked;
   if not found then continue; end if;
   selected:=selected||jsonb_build_array(jsonb_build_object('user',op.user_id,'op',op.op_id,'month',op.usage_month,'free',op.charged_free,'monthly',op.reserved));
 end loop;
 for item in select value from jsonb_array_elements(selected) loop
   -- Refuse to claim successful compensation when the counters are missing/corrupt.
   -- Match existing global -> owner month -> free usage order. Use the RESERVED month.
   if (item->>'monthly')::boolean then
     perform 1 from public.ai_chat_monthly_global_usage where usage_month=(item->>'month')::date and question_count>0 for update;
     if not found then raise exception 'question_usage_dependency_missing'; end if;
     perform 1 from public.ai_chat_monthly_user_usage where usage_month=(item->>'month')::date and user_id=(item->>'user')::uuid and question_count>0 for update;
     if not found then raise exception 'question_usage_dependency_missing'; end if;
   end if;
   if (item->>'free')::boolean then
     perform 1 from public.reading_usage where user_id=(item->>'user')::uuid and free_questions_used>0 for update;
     if not found then raise exception 'question_usage_dependency_missing'; end if;
   end if;
   outcome:=public.fail_reading_question((item->>'user')::uuid,(item->>'op')::uuid,null,true);
   if coalesce(outcome->>'state','') not in ('failed','deleted') then raise exception 'reconciliation_not_acknowledged'; end if;
   examined:=examined+1;
   if (item->>'free')::boolean then free_count:=free_count+1; end if;
   if (item->>'monthly')::boolean then monthly_count:=monthly_count+1; end if;
 end loop;
 select exists(select 1 from public.reading_question_operations where state='pending' and lease_until<=cutoff) into has_more;
 return jsonb_build_object('mode','apply','examined',examined,'wouldReleaseFree',0,'wouldReleaseMonthly',0,'reconciled',examined,
   'releasedFree',free_count,'releasedMonthly',monthly_count,'hasMore',has_more,'busy',false);
 -- Whole-batch rollback on any exception; no independent compensating writes.
end $$;
revoke all on function public.reconcile_reading_questions(boolean,integer) from public,anon,authenticated;
grant execute on function public.reconcile_reading_questions(boolean,integer) to service_role;
commit;
