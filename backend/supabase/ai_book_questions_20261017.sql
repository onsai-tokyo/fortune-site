begin;

create table public.ai_book_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.ai_books(id) on delete cascade,
  operation_id uuid not null,
  question text not null check (char_length(question) between 1 and 1200),
  answer text,
  state text not null default 'generating' check (state in ('generating','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  monthly_reserved boolean not null default false,
  unique(user_id, operation_id)
);
alter table public.ai_book_questions add column if not exists monthly_reserved boolean not null default false;
create index ai_book_questions_book on public.ai_book_questions(user_id, book_id, created_at);
alter table public.ai_book_questions enable row level security;
revoke all on public.ai_book_questions from public,anon,authenticated;
grant select,insert,update,delete on public.ai_book_questions to service_role;

create or replace function public.ai_book_question_begin(
  p_user uuid, p_book uuid, p_operation uuid, p_question text,
  p_user_limit integer, p_global_limit integer
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare existing public.ai_book_questions; stale public.ai_book_questions; book_owner uuid; used integer;
  reservation text;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai-book-question:'||p_book::text,0));
  select * into existing from public.ai_book_questions where user_id=p_user and operation_id=p_operation;
  if found then
    if existing.book_id<>p_book or existing.question<>p_question then raise exception 'BOOK_QUESTION_OPERATION_CONFLICT'; end if;
    return jsonb_build_object('state',existing.state,'id',existing.id,'answer',existing.answer,'created',false);
  end if;
  select user_id into book_owner from public.ai_books where id=p_book and state='delivered';
  if book_owner is null then raise exception 'BOOK_NOT_FOUND'; end if;
  if book_owner<>p_user then raise exception 'BOOK_NOT_FOUND'; end if;
  for stale in select * from public.ai_book_questions
    where user_id=p_user and book_id=p_book and state='generating'
      and updated_at < now() - interval '10 minutes' for update
  loop
    if stale.monthly_reserved then perform public.refund_ai_chat_question(p_user); end if;
    update public.ai_book_questions set state='failed',monthly_reserved=false,updated_at=now() where id=stale.id;
  end loop;
  select count(*) into used from public.ai_book_questions
    where user_id=p_user and book_id=p_book and state in ('generating','completed');
  if used>=2 then raise exception 'BOOK_QUESTION_LIMIT'; end if;
  select public.reserve_ai_chat_question(p_user,p_user_limit,p_global_limit) into reservation;
  if reservation <> 'ok' then
    if reservation = 'user_limit' then raise exception 'AI_BOOK_MONTHLY_USER_LIMIT'; end if;
    raise exception 'AI_BOOK_MONTHLY_GLOBAL_LIMIT';
  end if;
  insert into public.ai_book_questions(user_id,book_id,operation_id,question)
    values(p_user,p_book,p_operation,p_question) returning * into existing;
  update public.ai_book_questions set monthly_reserved=true where id=existing.id;
  return jsonb_build_object('state','generating','id',existing.id,'created',true);
end $$;

create or replace function public.ai_book_question_complete(
  p_user uuid, p_operation uuid, p_answer text
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare q public.ai_book_questions;
begin
  select * into q from public.ai_book_questions where user_id=p_user and operation_id=p_operation for update;
  if not found then raise exception 'BOOK_QUESTION_NOT_FOUND'; end if;
  if q.state <> 'generating' then
    return jsonb_build_object('state',q.state,'id',q.id,'answer',q.answer);
  end if;
  update public.ai_book_questions set answer=p_answer,state='completed',updated_at=now() where id=q.id and state='generating';
  return jsonb_build_object('state','completed','id',q.id,'answer',p_answer);
end $$;

create or replace function public.ai_book_question_fail(p_user uuid, p_operation uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  update public.ai_book_questions set state='failed',updated_at=now()
    where user_id=p_user and operation_id=p_operation and state='generating';
  if found then
    -- A failed generation must not consume the shared monthly AI budget.
    if (select monthly_reserved from public.ai_book_questions where user_id=p_user and operation_id=p_operation) then
      perform public.refund_ai_chat_question(p_user);
      update public.ai_book_questions set monthly_reserved=false where user_id=p_user and operation_id=p_operation;
    end if;
  end if;
  return found;
end $$;

drop function if exists public.ai_book_question_begin(uuid,uuid,uuid,text);
revoke all on function public.ai_book_question_begin(uuid,uuid,uuid,text,integer,integer),public.ai_book_question_complete(uuid,uuid,text),public.ai_book_question_fail(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ai_book_question_begin(uuid,uuid,uuid,text,integer,integer),public.ai_book_question_complete(uuid,uuid,text),public.ai_book_question_fail(uuid,uuid) to service_role;
commit;
