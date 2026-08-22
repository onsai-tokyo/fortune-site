-- 会話そのものは生成時点で保存済みのため、利用者が残したい鑑定を示すブックマークだけを追加する。
alter table public.reading_conversations
  add column if not exists is_saved boolean not null default false;

create index if not exists reading_conversations_user_saved_updated_idx
  on public.reading_conversations (user_id, is_saved desc, updated_at desc);
