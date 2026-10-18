# 仮データ版の画面テスト（Playwright / Python）

`/demo` があるビルド（`npm run build && npx vite preview --port 4173`）に対して動かす。
本番接続後の体験の期待値の参考として残している。

```
pip install playwright   # ブラウザは環境に合わせて用意
python3 journey.py   # 初回入力 → 書いてから払う → 自動作成 → 本棚
python3 guest.py     # 匿名 → 相手の入れ替え → 購入 → メール登録 → 別端末で引き継ぎ
python3 logic.py     # iOS・サーバーと同じルール（テーマ、文字数、禁止語、関係17種、出会った年 など）
python3 bugs.py      # 過去に直したバグの再発確認
python3 probe3.py    # 端端のケース（利用をやめた後、直接開いたURL など）
python3 crawl.py     # 6つの状態で全リンクをたどり、エラー・画像切れ・はみ出しを確認
```

`OK` / `FAIL` が1行ずつ出る。最後に `pageerrors []` なら画面のエラーなし。

OTPは未設定ビルドで8桁。staging相当は `VITE_EMAIL_OTP_LENGTH=6 npm run build` で別outDirへビルドし、テストにも `MOCK_E2E_OTP_LENGTH=6` を渡す（guest / return_to / email_otpが対応）。`email_otp.py` は案内・ラベル・入力上限・数字フィルター・不正桁数のエラー・先頭ゼロ・引き継ぎ成功をローカル見本で検証する。本番のメール配送やサーバーでのOTP照合を代替しない。

`legal_pages.py` は認証なしで `/terms`・`/privacy`・`/tokushoho` を開き、全条文見出し、販売準備中、確認済み委託先/リージョン、未確定情報の保持、モバイル幅、旧 `/tokushohou` の転送を確認する。これは文面の法的な適否や専門家確認の代替ではない。

既存プレビューを止めずに別ポートで確認する場合、全6本で
`MOCK_E2E_BASE_URL=https://localhost:4175 python3 guest.py` のように指定できる。
自己署名証明書を許容するのはローカル画面テストのブラウザだけで、本番設定には使わない。
これらのスクリプトはFAIL表示があっても終了コード0になることがあるため、終了コードだけで合格とせず、出力のFAIL・pageerrors・crawlerのissuesを確認する。

crawlは相手が登録済みの4プリセットに限り `/couple` → `/couple/p-misaki` を仕様どおりの遷移として別集計する。それ以外の問題はissuesとして残し、終了コード1にする。

## REMOTEの決済制御（ローカルfixture専用・追加テスト）

`payments_remote.py` は全APIを合成応答で代替する。実Supabase/Render/Anthropicへは接続しない。
架空の `VITE_SUPABASE_URL=https://mock.invalid`、`VITE_SUPABASE_ANON_KEY=mock-anon-key` と
`VITE_PAYMENTS_ENABLED=false` で別outDirへビルドし、別ポートでpreviewする。
`MOCK_E2E_BASE_URL=https://localhost:4176 python3 payments_remote.py` で購入オフと付与済みの作成・質問を検証する。
trueビルドでは `MOCK_PAYMENTS_ENABLED=true` を付け、REMOTE仮付与が無効のままか検証する。
上記の架空の値はテスト専用で、デプロイ用環境変数へ保存しない。
# 旧ログインのREMOTE fixture

旧法務/SEOの `legacy_legal_seo.py` は通常の見本ビルドで実行する。Vite previewはVercel設定を実行しないため、SEOのrewriteは設定JSONと実際のdist HTMLをブラウザーfixtureで対応づける。実VercelでのURL確認は公開前に別途必要。アプリ向け保存文書はStripe料金を取得せず、保存本文・元ソースSHA256・Web文書との区別を検査する。

`legacy_login.py` は通常の見本ビルドではなく、公開用に見せかけた合成値だけでビルドして実行する。

```sh
cd frontend
VITE_SUPABASE_URL=https://mock.invalid VITE_SUPABASE_ANON_KEY=mock-anon-key VITE_PAYMENTS_ENABLED=false npm exec vite build -- --outDir /private/tmp/fatelab-legacy-auth-fixture-20261018
npm run preview -- --host 127.0.0.1 --port 4192 --strictPort --outDir /private/tmp/fatelab-legacy-auth-fixture-20261018
```

別ターミナルでリポジトリ直下から `MOCK_E2E_BASE_URL=https://127.0.0.1:4192 python3 docs/mock-e2e/legacy_login.py` を実行。実際のSupabase値や秘密鍵を入れない。外部通信はfixtureで遮断し、テスト用パスワードも合成文字列のみを使う。Googleは戻り先指定までの検証で、本番OAuth一往復の代替ではない。
