-- Fate Lab 相性鑑定の会話・履歴保存
-- 既存の reading_conversations に相性用の識別子を追加する。

ALTER TABLE reading_conversations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS partner_profile_id uuid REFERENCES partner_profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reading_conversations_kind_check'
  ) THEN
    ALTER TABLE reading_conversations
      ADD CONSTRAINT reading_conversations_kind_check
      CHECK (kind IN ('self', 'compatibility'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reading_conversations_partner_idx
  ON reading_conversations(user_id, partner_profile_id, updated_at DESC)
  WHERE kind = 'compatibility';
