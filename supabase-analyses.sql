-- analyses テーブル（鑑定・チャット履歴）
CREATE TABLE IF NOT EXISTS analyses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature text NOT NULL,        -- 'self' | 'compat' | 'marriage' | 'org' | 'recruit' | 'chat'
  birth_date text,              -- 生年月日 YYYY-MM-DD
  title text,                   -- 表示用タイトル
  content jsonb,                -- チャット: [{role, content}] の配列
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分の履歴のみ操作可能" ON analyses
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
