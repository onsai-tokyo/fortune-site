-- Deploy the backend's owner-filtered service reads before this migration.
-- Apply before enabling READING_CARD_PURCHASES. Saved snapshots are not modified.
begin;
revoke select on public.reading_conversations,public.reading_revisions from public,anon,authenticated;
-- Also remove pre-existing column grants, if any, before restoring the allowlist.
do $$ declare t text; cols text; begin
 foreach t in array array['reading_conversations','reading_revisions'] loop
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns
   where table_schema='public' and table_name=t;
  execute format('revoke select (%s) on public.%I from public,anon,authenticated',cols,t);
 end loop;
end $$;
-- Legacy installations differ in optional metadata columns (e.g. secret_token).
do $$ declare cols text; begin
 select string_agg(quote_ident(column_name),',') into cols from information_schema.columns
 where table_schema='public' and table_name='reading_conversations'
 and column_name=any(array['id','user_id','secret_token','title','kind','is_saved','partner_profile_id','birth_data',
 'source_section','source_year','created_at','updated_at','reading_revision_id']);
 execute format('grant select (%s) on public.reading_conversations to authenticated',cols);
end $$;
grant select (id,reading_id,user_id,payload_hash,declared_versions,origin,created_at)
 on public.reading_revisions to authenticated;
grant select on public.reading_conversations,public.reading_revisions to service_role;

-- The original completion RPC can return an already-completed full report.
-- Only a trusted server may call either overload, then project the response.
revoke all on function public.complete_compatibility_operation(uuid,uuid,jsonb,text)
 from public,anon,authenticated,service_role;
create or replace function public.complete_compatibility_operation(p_user uuid,p_op uuid,p_worker uuid,p_payload jsonb,p_title text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare result jsonb; old_sub text:=current_setting('request.jwt.claim.sub',true);
 old_claims text:=current_setting('request.jwt.claims',true);
begin
 if p_user is null then raise exception 'authentication_required'; end if;
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated')::text,true);
 result:=public.complete_compatibility_operation(p_op,p_worker,p_payload,p_title);
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
 return result;
end $$;
revoke all on function public.complete_compatibility_operation(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.complete_compatibility_operation(uuid,uuid,uuid,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
