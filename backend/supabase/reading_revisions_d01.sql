begin;
create table public.logical_readings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 identity_key text not null, created_at timestamptz not null default now(), unique(user_id,identity_key)
);
create table public.reading_revisions (
 id uuid primary key default gen_random_uuid(), reading_id uuid not null references public.logical_readings(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, payload_hash text not null,
 payload jsonb not null, declared_versions jsonb, origin text not null check(origin in ('legacy_snapshot','saved_snapshot')),
 created_at timestamptz not null default now(), unique(reading_id,payload_hash)
);
create table public.reading_save_operations (
 user_id uuid not null references auth.users(id) on delete cascade, op_id text not null, payload_hash text not null,
 revision_id uuid not null references public.reading_revisions(id) on delete cascade,
 conversation_id uuid references public.reading_conversations(id) on delete set null,
 created_at timestamptz not null default now(), primary key(user_id,op_id)
);
alter table public.reading_conversations add column reading_revision_id uuid references public.reading_revisions(id);

-- Do not infer version or equivalence of old records, even from birth-data hashes.
insert into public.logical_readings(id,user_id,identity_key,created_at)
select id,user_id,'legacy:'||id::text,created_at from public.reading_conversations;
insert into public.reading_revisions(id,reading_id,user_id,payload_hash,payload,declared_versions,origin,created_at)
select id,id,user_id,encode(sha256(convert_to(jsonb_build_object('birthData',birth_data,'calculatedData',calculated_data,
 'reportText',report_text,'sourceSection',source_section,'sourceYear',source_year,'kind',kind,'partnerProfileId',partner_profile_id)::text,'UTF8')),'hex'),
 jsonb_build_object('birthData',birth_data,'calculatedData',calculated_data,'reportText',report_text,
 'sourceSection',source_section,'sourceYear',source_year,'kind',kind,'partnerProfileId',partner_profile_id),
 null,'legacy_snapshot',created_at from public.reading_conversations;
update public.reading_conversations set reading_revision_id=id;
alter table public.reading_conversations alter column reading_revision_id set not null;
create index reading_revision_owner_idx on public.reading_revisions(user_id,reading_id,created_at);
create unique index reading_revision_conversation_idx on public.reading_conversations(reading_revision_id) where kind <> 'chat';

alter table public.logical_readings enable row level security;
alter table public.reading_revisions enable row level security;
alter table public.reading_save_operations enable row level security;
create policy reading_identity_owner on public.logical_readings for select using(auth.uid()=user_id);
create policy reading_revision_owner on public.reading_revisions for select using(auth.uid()=user_id);
create policy reading_operation_owner on public.reading_save_operations for select using(auth.uid()=user_id);
revoke all on public.logical_readings,public.reading_revisions,public.reading_save_operations from public,anon,authenticated,service_role;
grant select on public.logical_readings,public.reading_revisions,public.reading_save_operations to authenticated,service_role;

create function public.reading_revision_immutable() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin raise exception 'reading_revision_immutable'; end $$;
create trigger reading_revision_no_update before update on public.reading_revisions for each row execute function public.reading_revision_immutable();
create function public.reading_conversation_snapshot_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare rev public.reading_revisions;
begin
 if tg_op='UPDATE' and (new.user_id,new.reading_revision_id,new.birth_data,new.calculated_data,new.report_text,new.source_section,new.source_year,new.kind)
   is distinct from (old.user_id,old.reading_revision_id,old.birth_data,old.calculated_data,old.report_text,old.source_section,old.source_year,old.kind) then
   raise exception 'reading_snapshot_immutable';
 end if;
 -- A deleted partner may clear the relational FK; the historical payload stays intact.
 if tg_op='UPDATE' and new.partner_profile_id is distinct from old.partner_profile_id and not
   (new.partner_profile_id is null and not exists(select 1 from public.partner_profiles where id=old.partner_profile_id)) then
   raise exception 'reading_partner_immutable';
 end if;
 if tg_op='INSERT' then
   select * into rev from public.reading_revisions where id=new.reading_revision_id and user_id=new.user_id;
   if not found or new.report_text is distinct from rev.payload->>'reportText' or
      new.calculated_data is distinct from rev.payload->'calculatedData' or
      (new.birth_data - '_sourceConversationId' - '_sourceKind') is distinct from ((rev.payload->'birthData') - '_sourceConversationId' - '_sourceKind') or
      new.source_section is distinct from rev.payload->>'sourceSection' or
      new.source_year is distinct from (rev.payload->>'sourceYear')::integer or
      (new.partner_profile_id is distinct from (rev.payload->>'partnerProfileId')::uuid and not
        (new.partner_profile_id is null and not exists(select 1 from public.partner_profiles where id=(rev.payload->>'partnerProfileId')::uuid))) or
      (new.kind <> 'chat' and new.kind is distinct from rev.payload->>'kind') then raise exception 'reading_revision_mismatch'; end if;
 end if;
 return new;
end $$;
create trigger reading_conversation_snapshot_guard before insert or update on public.reading_conversations for each row execute function public.reading_conversation_snapshot_guard();

create function public.save_reading_revision(p_op_id text,p_payload jsonb,p_title text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare owner uuid:=auth.uid(); h text; logical_key text; logical_id uuid; revision uuid; conversation uuid;
 existing public.reading_save_operations; reused boolean:=false;
begin
 if owner is null then raise exception 'authentication_required'; end if;
 if p_op_id is null or p_op_id !~ '^[a-zA-Z0-9:_-]{1,128}$' then raise exception 'invalid_operation_id'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'birthData') is distinct from 'object' or
    jsonb_typeof(p_payload->'calculatedData') is distinct from 'object' or jsonb_typeof(p_payload->'reportText') is distinct from 'string' or
    coalesce(p_payload->>'kind','') not in ('self','compatibility') or length(trim(p_payload->>'reportText'))=0 or length(p_payload->>'reportText')>60000 then raise exception 'invalid_reading_payload'; end if;
 h:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
 logical_key:=encode(sha256(convert_to(jsonb_build_object('birth',p_payload->'birthData','kind',p_payload->'kind',
   'partner',p_payload->'partnerProfileId','section',p_payload->'sourceSection','year',p_payload->'sourceYear')::text,'UTF8')),'hex');
 -- Serializes saves for one owner, including different opIds of the same payload.
 perform pg_advisory_xact_lock(hashtextextended('reading-save:'||owner::text,0));
 select * into existing from public.reading_save_operations where user_id=owner and op_id=p_op_id;
 if found then
   if existing.payload_hash<>h then return jsonb_build_object('conflict',true); end if;
   if existing.conversation_id is null then return jsonb_build_object('deleted',true); end if;
   return jsonb_build_object('id',existing.conversation_id,'revisionId',existing.revision_id,'reused',true);
 end if;
 if p_payload->>'partnerProfileId' is not null and not exists
   (select 1 from public.partner_profiles where id=(p_payload->>'partnerProfileId')::uuid and user_id=owner) then
   raise exception 'partner_owner_mismatch';
 end if;
 insert into public.logical_readings(user_id,identity_key) values(owner,logical_key) on conflict do nothing;
 select id into strict logical_id from public.logical_readings where user_id=owner and identity_key=logical_key;
 insert into public.reading_revisions(reading_id,user_id,payload_hash,payload,declared_versions,origin)
 values(logical_id,owner,h,p_payload,p_payload->'declaredVersions','saved_snapshot') on conflict do nothing;
 select id into strict revision from public.reading_revisions where reading_id=logical_id and payload_hash=h;
 select id into conversation from public.reading_conversations where reading_revision_id=revision and kind<>'chat';
 if found then reused:=true;
 else
   insert into public.reading_conversations(user_id,title,kind,partner_profile_id,birth_data,calculated_data,report_text,
     source_section,source_year,reading_revision_id)
   values(owner,left(coalesce(p_title,'鑑定結果'),80),p_payload->>'kind',(p_payload->>'partnerProfileId')::uuid,
     p_payload->'birthData',p_payload->'calculatedData',p_payload->>'reportText',p_payload->>'sourceSection',
     (p_payload->>'sourceYear')::integer,revision) returning id into conversation;
 end if;
 insert into public.reading_save_operations(user_id,op_id,payload_hash,revision_id,conversation_id) values(owner,p_op_id,h,revision,conversation);
 return jsonb_build_object('id',conversation,'readingId',logical_id,'revisionId',revision,'reused',reused);
end $$;
revoke all on function public.save_reading_revision(text,jsonb,text) from public,anon,service_role;
grant execute on function public.save_reading_revision(text,jsonb,text) to authenticated;
commit;
