-- Fate Lab 本人用鑑定URL / 共有用要点URL
-- Supabase SQL Editorで一度実行してください。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE reading_conversations
  ADD COLUMN IF NOT EXISTS secret_token text;

UPDATE reading_conversations
SET secret_token = encode(gen_random_bytes(24), 'hex')
WHERE secret_token IS NULL;

ALTER TABLE reading_conversations
  ALTER COLUMN secret_token SET DEFAULT encode(gen_random_bytes(24), 'hex'),
  ALTER COLUMN secret_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reading_conversations_secret_token_idx
  ON reading_conversations(secret_token);

CREATE TABLE IF NOT EXISTS reading_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex') UNIQUE,
  conversation_id uuid REFERENCES reading_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id)
);

ALTER TABLE reading_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reading shares" ON reading_shares
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reading_shares_user_updated_idx
  ON reading_shares(user_id, updated_at DESC);

-- 公開読み取りはservice roleを使用するAPIだけに限定する。
REVOKE ALL ON reading_shares FROM anon;
