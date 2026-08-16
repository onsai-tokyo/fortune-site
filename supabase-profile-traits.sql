-- Fate Lab 確認カード / Personal Profile
-- Supabase SQL Editorで一度実行してください。

CREATE TABLE IF NOT EXISTS profile_traits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reading_id uuid REFERENCES reading_conversations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES reading_conversations(id) ON DELETE CASCADE,
  source_message_id uuid REFERENCES reading_messages(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('decision', 'work', 'love', 'relation', 'value')),
  text text NOT NULL CHECK (char_length(text) BETWEEN 4 AND 120),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  UNIQUE (user_id, source_message_id, text)
);

ALTER TABLE profile_traits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own profile traits" ON profile_traits;
CREATE POLICY "Users manage own profile traits" ON profile_traits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS profile_traits_user_status_created_idx
  ON profile_traits(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_traits_conversation_created_idx
  ON profile_traits(conversation_id, created_at DESC);
