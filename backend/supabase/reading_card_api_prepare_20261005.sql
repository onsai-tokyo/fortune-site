-- Add the service-only overload first; keep the old API working until rollout.
begin;
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
