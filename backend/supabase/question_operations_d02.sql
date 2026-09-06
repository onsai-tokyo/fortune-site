begin;
create table public.reading_question_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 op_id uuid not null, conversation_id uuid references public.reading_conversations(id) on delete set null,
 target_conversation_id uuid not null, payload_hash text not null, question text not null,
 state text not null check(state in ('pending','completed','failed')),
 worker_id uuid not null, lease_until timestamptz not null,
 usage_month date not null, charged_free boolean not null default false, reserved boolean not null default false,
 result jsonb, failure_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,op_id)
);
create index reading_question_pending_idx on public.reading_question_operations(user_id,conversation_id) where state='pending';
alter table public.reading_question_operations enable row level security;
revoke all on public.reading_question_operations from public,anon,authenticated,service_role;
grant select on public.reading_question_operations to service_role;

create function public.begin_reading_question(p_user uuid,p_op uuid,p_conversation uuid,p_question text,p_worker uuid,p_free_limit integer,p_user_limit integer,p_global_limit integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.reading_question_operations; h text; reservation text; used integer; stale_op uuid;
begin
 if p_op is null or p_worker is null or p_question is null or length(trim(p_question))=0 or length(p_question)>1200 then raise exception 'invalid_question_operation'; end if;
 h:=encode(sha256(convert_to(jsonb_build_object('conversationId',p_conversation,'question',p_question)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('question-owner:'||p_user::text,0));
 select * into op from public.reading_question_operations where user_id=p_user and op_id=p_op for update;
 if found then
   if op.payload_hash<>h then return jsonb_build_object('state','conflict'); end if;
   if op.conversation_id is null then return jsonb_build_object('state','deleted'); end if;
   if op.state='pending' and op.lease_until<=clock_timestamp() then return public.fail_reading_question(p_user,p_op,null,true); end if;
   return jsonb_build_object('state',op.state,'result',op.result,'code',op.failure_code);
 end if;
 perform 1 from public.reading_conversations where id=p_conversation and user_id=p_user for key share;
 if not found then return jsonb_build_object('state','not_found'); end if;
 for stale_op in select op_id from public.reading_question_operations where user_id=p_user and conversation_id=p_conversation and state='pending' and lease_until<=clock_timestamp() loop
   perform public.fail_reading_question(p_user,stale_op,null,true);
 end loop;
 -- A second operation cannot build a competing history while this conversation is in flight.
 if exists(select 1 from public.reading_question_operations where user_id=p_user and conversation_id=p_conversation and state='pending') then
   return jsonb_build_object('state','busy');
 end if;
 insert into public.reading_question_operations(user_id,op_id,conversation_id,target_conversation_id,payload_hash,question,state,worker_id,lease_until,usage_month)
 values(p_user,p_op,p_conversation,p_conversation,h,p_question,'pending',p_worker,clock_timestamp()+interval '5 minutes',date_trunc('month',timezone('Asia/Tokyo',now()))::date);
 if p_free_limit is not null then
   used:=public.consume_free_reading_question(p_user,p_free_limit);
   if used=-1 then
     update public.reading_question_operations set state='failed',failure_code='FREE_LIMIT_REACHED' where user_id=p_user and op_id=p_op;
     return jsonb_build_object('state','failed','code','FREE_LIMIT_REACHED');
   end if;
   update public.reading_question_operations set charged_free=true where user_id=p_user and op_id=p_op;
 end if;
 reservation:=public.reserve_ai_chat_question(p_user,p_user_limit,p_global_limit);
 if reservation<>'ok' then
   if p_free_limit is not null then perform public.refund_free_reading_question(p_user); end if;
   update public.reading_question_operations set state='failed',charged_free=false,failure_code=case when reservation='user_limit' then 'MONTHLY_QUESTION_LIMIT_REACHED' else 'AI_MONTHLY_BUDGET_REACHED' end where user_id=p_user and op_id=p_op returning * into op;
   return jsonb_build_object('state','failed','code',op.failure_code);
 end if;
 update public.reading_question_operations set reserved=true where user_id=p_user and op_id=p_op;
 return jsonb_build_object('state','started');
end $$;

create function public.fail_reading_question(p_user uuid,p_op uuid,p_worker uuid,p_expired_only boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.reading_question_operations;
begin
 perform pg_advisory_xact_lock(hashtextextended('question-owner:'||p_user::text,0));
 select * into op from public.reading_question_operations where user_id=p_user and op_id=p_op for update;
 if not found then return jsonb_build_object('state','not_found'); end if;
 if op.state='pending' and (op.conversation_id is null or (p_expired_only and op.lease_until<=clock_timestamp()) or (not p_expired_only and op.worker_id=p_worker)) then
   -- Lock order matches reserve: global month, then owner month. Use the RESERVED month.
   if op.reserved then
     update public.ai_chat_monthly_global_usage set question_count=greatest(0,question_count-1),updated_at=now() where usage_month=op.usage_month;
     update public.ai_chat_monthly_user_usage set question_count=greatest(0,question_count-1),updated_at=now() where usage_month=op.usage_month and user_id=p_user;
   end if;
   if op.charged_free then perform public.refund_free_reading_question(p_user); end if;
   update public.reading_question_operations set state='failed',reserved=false,charged_free=false,failure_code='QUESTION_FAILED',updated_at=now() where user_id=p_user and op_id=p_op returning * into op;
 end if;
 if op.conversation_id is null then return jsonb_build_object('state','deleted'); end if;
 return jsonb_build_object('state',op.state,'result',op.result,'code',op.failure_code);
end $$;

create function public.complete_reading_question(p_user uuid,p_op uuid,p_worker uuid,p_answer text,p_systems text[],p_suggestions jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.reading_question_operations; question_id uuid; answer_id uuid; saved_result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('question-owner:'||p_user::text,0));
 select * into op from public.reading_question_operations where user_id=p_user and op_id=p_op for update;
 if not found then return jsonb_build_object('state','not_found'); end if;
 if op.conversation_id is null then return jsonb_build_object('state','deleted'); end if;
 if op.state='completed' then return jsonb_build_object('state','completed','result',op.result); end if;
 if op.state<>'pending' or op.worker_id<>p_worker or op.lease_until<=clock_timestamp() then return jsonb_build_object('state','pending'); end if;
 if p_answer is null or length(trim(p_answer))=0 or length(p_answer)>20000 or jsonb_typeof(p_suggestions) is distinct from 'array' then raise exception 'invalid_answer'; end if;
 insert into public.reading_messages(conversation_id,user_id,role,content) values(op.conversation_id,p_user,'user',op.question) returning id into question_id;
 insert into public.reading_messages(conversation_id,user_id,role,content,referenced_systems) values(op.conversation_id,p_user,'assistant',p_answer,p_systems) returning id into answer_id;
 update public.reading_conversations set updated_at=now() where id=op.conversation_id and user_id=p_user;
 saved_result:=jsonb_build_object('answer',p_answer,'suggestions',p_suggestions,'referencedSystems',p_systems,'questionId',question_id,'answerId',answer_id);
 update public.reading_question_operations set state='completed',result=saved_result,updated_at=now() where user_id=p_user and op_id=p_op;
 return jsonb_build_object('state','completed','result',saved_result);
end $$;
create function public.release_deleted_question_operations() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare op public.reading_question_operations;
begin
 for op in select * from public.reading_question_operations where target_conversation_id=old.id and state='pending' loop
   perform public.fail_reading_question(op.user_id,op.op_id,op.worker_id,false);
 end loop;
 return old;
end $$;
create trigger release_deleted_question_operations after delete on public.reading_conversations for each row execute function public.release_deleted_question_operations();
revoke all on function public.begin_reading_question(uuid,uuid,uuid,text,uuid,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.fail_reading_question(uuid,uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.complete_reading_question(uuid,uuid,uuid,text,text[],jsonb) from public,anon,authenticated;
grant execute on function public.begin_reading_question(uuid,uuid,uuid,text,uuid,integer,integer,integer) to service_role;
grant execute on function public.fail_reading_question(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.complete_reading_question(uuid,uuid,uuid,text,text[],jsonb) to service_role;
commit;
