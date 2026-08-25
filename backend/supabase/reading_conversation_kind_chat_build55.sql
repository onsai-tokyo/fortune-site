-- Build55: reading_conversations.kind に 'chat' を許可する。
--
-- 背景:
--   supabase-reading-stripe.sql / supabase-reading-compatibility.sql が
--     CHECK (kind IN ('self', 'compatibility'))
--   を定義しているが、backend/src/routes/reading.ts の
--   POST /conversations/:id/chat は kind: 'chat' を insert する。
--   そのため insert が必ず CHECK 制約違反となり 500 を返していた
--   （アプリ表示：「新しい対話を作成できませんでした」）。
--
--   同じ理由で kind='chat' の行が一件も作られないため、
--   GET /conversations の chat 判定が常に false となり、
--   チャット履歴画面が常に「まだ対話がありません」になっていた。
--
-- 実行: Supabase SQL Editor で一度実行する。アプリ配信より先に流すこと。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reading_conversations_kind_check'
      AND conrelid = 'public.reading_conversations'::regclass
  ) THEN
    ALTER TABLE public.reading_conversations
      DROP CONSTRAINT reading_conversations_kind_check;
  END IF;

  ALTER TABLE public.reading_conversations
    ADD CONSTRAINT reading_conversations_kind_check
    CHECK (kind IN ('self', 'personal', 'compatibility', 'chat'));
END $$;

-- 'personal' を含めた理由:
--   GET /status が .or('kind.is.null,kind.eq.personal,kind.eq.self') を使っており、
--   コード側が 'personal' も有効値として扱っているため、制約と実装を一致させる。

-- チャット履歴の一覧取得を高速化する（kind='chat' の行だけを updated_at 順に引く）。
CREATE INDEX IF NOT EXISTS reading_conversations_user_chat_updated_idx
  ON public.reading_conversations (user_id, updated_at DESC)
  WHERE kind = 'chat';
