-- 実行前に partner_profiles をバックアップすること。
-- cutoff は45-1のiOSビルドを配信した日時へ置き換え、修正後の登録を二重補正しない。
begin;

create table if not exists public.partner_profiles_build45_backup as
select * from public.partner_profiles where false;
insert into public.partner_profiles_build45_backup
select * from public.partner_profiles
where created_at < timestamptz '__BUILD45_DEPLOYED_AT__';

create table if not exists public.reading_conversations_build45_backup as
select * from public.reading_conversations where false;
insert into public.reading_conversations_build45_backup
select * from public.reading_conversations
where kind = 'compatibility'
  and created_at < timestamptz '__BUILD45_DEPLOYED_AT__';

update public.partner_profiles
set birth_date = birth_date + 1,
    updated_at = now()
where created_at < timestamptz '__BUILD45_DEPLOYED_AT__';

-- 日付ずれを前提に生成済みの相性会話は再利用せず、次回生成時に作り直す。
delete from public.reading_conversations
where kind = 'compatibility'
  and created_at < timestamptz '__BUILD45_DEPLOYED_AT__';

commit;
