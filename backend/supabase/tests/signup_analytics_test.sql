\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$ begin if public.claim_signup_analytics() then raise exception 'existing counted'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin if public.claim_signup_analytics() then raise exception 'unconfirmed counted'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
do $$ begin if public.claim_signup_analytics() then raise exception 'anonymous counted'; end if; end $$;
select set_config('request.jwt.claim.sub','',false);
do $$ begin if public.claim_signup_analytics() then raise exception 'no session counted'; end if; end $$;
do $$ begin
 begin perform * from public.signup_analytics_receipts; raise exception 'receipt readable'; exception when insufficient_privilege then null; end;
 begin insert into public.signup_analytics_receipts values('00000000-0000-4000-8000-000000000004',now()); raise exception 'receipt writable'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update auth.users set email_confirmed_at=now(),is_anonymous=false where id in ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
 if not public.claim_signup_analytics() then raise exception 'new confirmed not counted'; end if;
 if public.claim_signup_analytics() then raise exception 'reload counted twice'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.claim_signup_analytics()','execute') then raise exception 'anon executable'; end if;
end $$;
