-- Initial free book is not added to the monthly allocation. Preserve purchased slots and completed books.
begin;
create or replace function public.ai_book_sync_trial(p_user uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare identity text; fingerprint text; inserted integer; grant_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-book-user:'||p_user,0));
 if not (select enabled from public.ai_book_settings where id) then return; end if;
 -- Trial is an introduction for nonmembers, never a fourth subscription slot.
 if exists(select 1 from public.ai_book_grants where user_id=p_user and source='member') then
   update public.ai_book_grants set revoked=true where user_id=p_user and source='trial' and not revoked;
 end if;
 -- Only the authenticated account's server-verified identity can claim a trial.
 select lower(trim(email)) into identity from auth.users where id=p_user and email_confirmed_at is not null;
 if identity is null or identity='' then return; end if;
 select encode(sha256(convert_to(secret||':'||identity,'UTF8')),'hex') into fingerprint from public.ai_book_trial_secret where id;
 insert into public.ai_book_trial_claims values(fingerprint,now()) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 or exists(select 1 from public.ai_book_grants where user_id=p_user and source='member') then return; end if;
 insert into public.ai_book_grants(user_id,environment,transaction_id,source,quantity,starts_at,expires_at,revoked,signed_ms)
 values(p_user,'Production','trial:'||fingerprint,'trial',1,now(),null,false,0) returning id into grant_id;
 insert into public.ai_book_credits(grant_id,slot) values(grant_id,1);
end $$;
create or replace function public.ai_book_order(p_user uuid,p_operation uuid,p_source uuid,p_target text,p_theme text,p_question text,p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare b public.ai_books; c uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai-book-user:'||p_user,0));
  select * into b from public.ai_books where user_id=p_user and operation_id=p_operation;
  if found then
    if b.source_id<>p_source or b.question<>p_question or b.theme<>p_theme then raise exception 'BOOK_OPERATION_CONFLICT'; end if;
    return b.id;
  end if;
  if exists(select 1 from public.ai_book_cancellations where user_id=p_user and operation_id=p_operation) then raise exception 'BOOK_CANCELLED'; end if;
  perform public.ai_book_sync_trial(p_user);
  if not (select enabled from public.ai_book_settings where id) then raise exception 'BOOK_DISABLED'; end if;
  select cr.id into c from public.ai_book_credits cr join public.ai_book_grants g on g.id=cr.grant_id
    where g.user_id=p_user and not g.revoked and g.starts_at<=now() and cr.consumed_by is null
      and (g.expires_at is null or greatest(g.expires_at,cr.recovery_until)>now())
    order by case when g.source='trial' then 0 else 1 end, greatest(g.expires_at,cr.recovery_until) asc nulls last,g.created_at,cr.slot
    limit 1 for update of cr,g;
  if c is null then raise exception 'BOOK_NO_CREDITS'; end if;
  insert into public.ai_books(user_id,operation_id,source_id,target_title,theme,question,source_snapshot)
    values(p_user,p_operation,p_source,p_target,p_theme,p_question,p_snapshot) returning * into b;
  update public.ai_book_credits set consumed_by=b.id where id=c;
  return b.id;
end $$;
update public.ai_book_grants t set revoked=true where t.source='trial' and not t.revoked and exists(select 1 from public.ai_book_grants m where m.user_id=t.user_id and m.source='member');
commit;
