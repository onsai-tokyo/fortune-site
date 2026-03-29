-- ============================================================
-- fate-lab ポイントシステム マイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. user_points テーブル作成
CREATE TABLE IF NOT EXISTS user_points (
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  balance       integer NOT NULL DEFAULT 0,
  total_earned  integer NOT NULL DEFAULT 0,
  updated_at    timestamptz DEFAULT now()
);

-- 2. RLS 有効化
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

-- 3. ポリシー: 自分のポイントのみ参照可
CREATE POLICY "Users can view own points"
  ON user_points FOR SELECT
  USING (auth.uid() = user_id);

-- 4. 新規ユーザー登録時に3ポイント自動付与するトリガー
CREATE OR REPLACE FUNCTION public.initialize_user_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_points (user_id, balance, total_earned)
  VALUES (NEW.id, 3, 3)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_points ON auth.users;
CREATE TRIGGER on_auth_user_created_points
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_user_points();

-- 5. ポイント原子的デクリメント RPC
--    戻り値: 新残高（成功）/ -1（残高不足）
CREATE OR REPLACE FUNCTION public.deduct_points(target_user_id uuid, cost integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE public.user_points
  SET balance = balance - cost, updated_at = now()
  WHERE user_id = target_user_id AND balance >= cost
  RETURNING balance INTO new_balance;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN new_balance;
END;
$$;

-- 6. ポイント加算 RPC（決済後にバックエンドから呼び出す）
CREATE OR REPLACE FUNCTION public.add_points(target_user_id uuid, amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_balance integer;
BEGIN
  INSERT INTO public.user_points (user_id, balance, total_earned)
  VALUES (target_user_id, amount, amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance      = public.user_points.balance + EXCLUDED.balance,
        total_earned = public.user_points.total_earned + EXCLUDED.total_earned,
        updated_at   = now()
  RETURNING balance INTO new_balance;

  RETURN new_balance;
END;
$$;

-- 7. 既存ユーザーにも3ポイント付与（初回マイグレーション時のみ）
INSERT INTO public.user_points (user_id, balance, total_earned)
SELECT id, 3, 3 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
