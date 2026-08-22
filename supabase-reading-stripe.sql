-- Fate Lab 鑑定質問・Stripe subscription migration
-- Supabase SQL Editorで一度実行してください。

CREATE TABLE IF NOT EXISTS reading_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT '鑑定結果について',
  birth_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_text text NOT NULL DEFAULT '',
  source_section text,
  source_year integer,
  kind text NOT NULL DEFAULT 'self' CHECK (kind IN ('self', 'compatibility')),
  partner_profile_id uuid,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reading_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES reading_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  referenced_systems text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reading_usage (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  free_questions_used integer NOT NULL DEFAULT 0 CHECK (free_questions_used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  stripe_customer_id text UNIQUE NOT NULL,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  subscription_status text NOT NULL DEFAULT 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reading_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reading conversations" ON reading_conversations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own reading messages" ON reading_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own reading usage" ON reading_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own stripe subscription" ON stripe_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- 使用回数・課金状態はバックエンド(service role)だけが更新する。
REVOKE INSERT, UPDATE, DELETE ON reading_usage FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON stripe_subscriptions FROM authenticated;
REVOKE ALL ON stripe_webhook_events FROM anon, authenticated;
-- 旧PAY.JP subscriptionsを権限判定へ再利用する場合にも、利用者自身の書き換えを禁止する。
REVOKE INSERT, UPDATE, DELETE ON subscriptions FROM authenticated;

CREATE INDEX IF NOT EXISTS reading_conversations_user_updated_idx
  ON reading_conversations(user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS reading_conversations_user_idempotency_idx
  ON reading_conversations(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS reading_messages_conversation_created_idx
  ON reading_messages(conversation_id, created_at);

CREATE OR REPLACE FUNCTION consume_free_reading_question(target_user_id uuid, question_limit integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_used integer;
BEGIN
  INSERT INTO reading_usage(user_id, free_questions_used)
  VALUES (target_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE reading_usage
  SET free_questions_used = free_questions_used + 1, updated_at = now()
  WHERE user_id = target_user_id AND free_questions_used < question_limit
  RETURNING free_questions_used INTO next_used;

  RETURN COALESCE(next_used, -1);
END;
$$;
REVOKE ALL ON FUNCTION consume_free_reading_question(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_free_reading_question(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION refund_free_reading_question(target_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE reading_usage SET free_questions_used = GREATEST(0, free_questions_used - 1), updated_at = now()
  WHERE user_id = target_user_id;
$$;
REVOKE ALL ON FUNCTION refund_free_reading_question(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refund_free_reading_question(uuid) TO service_role;
