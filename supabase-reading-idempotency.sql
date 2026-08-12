-- Fate Lab 鑑定履歴の重複作成防止
-- 既に supabase-reading-stripe.sql を実行済みの環境で、一度実行してください。

ALTER TABLE reading_conversations
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS reading_conversations_user_idempotency_idx
  ON reading_conversations(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
