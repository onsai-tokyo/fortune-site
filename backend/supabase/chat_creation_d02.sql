begin;
create table public.reading_chat_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 op_id uuid not null, source_id uuid not null, payload_hash text not null,
 conversation_id uuid references public.reading_conversations(id) on delete set null,
 created_at timestamptz not null default now(), primary key(user_id,op_id)
);
alter table public.reading_chat_operations enable row level security;
revoke all on public.reading_chat_operations from public,anon,authenticated,service_role;

create function public.create_reading_chat(p_op uuid,p_source uuid,p_question text,p_title text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare owner uuid:=auth.uid(); h text; op public.reading_chat_operations;
 source public.reading_conversations; chat_id uuid;
begin
 if owner is null then raise exception 'authentication_required'; end if;
 if p_op is null or p_source is null or p_question is null or length(trim(p_question))=0 or length(p_question)>1200 then raise exception 'invalid_chat_operation'; end if;
 h:=encode(sha256(convert_to(jsonb_build_object('source',p_source,'question',p_question)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('chat-owner:'||owner::text,0));
 select * into op from public.reading_chat_operations where user_id=owner and op_id=p_op;
 if found then
   if op.payload_hash<>h then return jsonb_build_object('state','conflict'); end if;
   if op.conversation_id is null then return jsonb_build_object('state','deleted'); end if;
   return jsonb_build_object('state','completed','id',op.conversation_id,'reused',true);
 end if;
 select * into source from public.reading_conversations where id=p_source and user_id=owner for key share;
 if not found then return jsonb_build_object('state','not_found'); end if;
 if source.kind='chat' then chat_id:=source.id;
 else
   insert into public.reading_conversations(user_id,title,kind,reading_revision_id,is_saved,partner_profile_id,birth_data,
     calculated_data,report_text,source_section,source_year)
   values(owner,left(coalesce(p_title,'新しい対話'),80),'chat',source.reading_revision_id,true,source.partner_profile_id,
     source.birth_data||jsonb_build_object('_sourceConversationId',source.id,'_sourceKind',source.kind),
     source.calculated_data,source.report_text,source.source_section,source.source_year) returning id into chat_id;
 end if;
 insert into public.reading_chat_operations(user_id,op_id,source_id,payload_hash,conversation_id) values(owner,p_op,p_source,h,chat_id);
 return jsonb_build_object('state','completed','id',chat_id,'reused',source.kind='chat');
end $$;
revoke all on function public.create_reading_chat(uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.create_reading_chat(uuid,uuid,text,text) to authenticated;
commit;
