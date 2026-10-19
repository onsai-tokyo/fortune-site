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

`legal_pages.py` は認証なしで `/terms`・`/privacy`・`/tokushoho` を開き、全条文見出し、販売準備中、確認済み委託先/リージョン、仮置き/編集注記の不在、AI公開方針の公式リンク、モバイル幅、旧 `/tokushohou` のアプリ向け保存版を確認する。未確定条件は公開文ではなく `docs/legal-publication-preparation-20261018.md` に記録する。外部/API通信は遮断する。これは文面の法的な適否や専門家確認の代替ではない。

`support.py` はWeb専用 `/support` と `/contact` の転送、承認済みメール宛先、Web版FAQ（引き継ぎ・販売準備中・年齢条件等）、Web用 `/tokushoho` への遷移、320/390px幅を検査する。外部/API通信は遮断し、メールリンクは宛先を読むだけで送信しない。実行例：`MOCK_E2E_BASE_URL=https://127.0.0.1:4198 python3 docs/mock-e2e/support.py`（リポジトリ直下から）。実メール受信や実Vercelの動作確認を代替しない。

既存プレビューを止めずに別ポートで確認する場合、全6本で
`MOCK_E2E_BASE_URL=https://localhost:4175 python3 guest.py` のように指定できる。
自己署名証明書を許容するのはローカル画面テストのブラウザだけで、本番設定には使わない。
`partner_replacement_remote.py` は合成REMOTEビルドで実行する追加テスト。DELETEの204、削除失敗・削除応答不明、登録失敗・登録応答不明、出会った年の保存失敗、再取得失敗、途中のアカウント切替を検証する。入力とユーザー別の操作IDを復元し、再読み込みだけでは再送せず、明示的な再試行でも新しい相手を削除・重複登録しないことを確認する。実Supabase・Renderへは接続しない。
`account_deletion_remote.py` も同じ合成REMOTEビルドで実行する。退会DELETEの204成功、500失敗、応答喪失、処理中の別アカウント切替を検証する。成功確認前に画面遷移・ログアウト・下書き削除をせず、失敗時は案内とセッションを維持する。実アカウントや本番DBは削除しない。
これらのスクリプトはFAIL表示があっても終了コード0になることがあるため、終了コードだけで合格とせず、出力のFAIL・pageerrors・crawlerのissuesを確認する。

crawlは相手が登録済みの4プリセットに限り `/couple` → `/couple/p-misaki` を仕様どおりの遷移として別集計する。それ以外の問題はissuesとして残し、終了コード1にする。

## REMOTEの決済制御（ローカルfixture専用・追加テスト）

`payments_remote.py` は全APIを合成応答で代替する。実Supabase/Render/Anthropicへは接続しない。
架空の `VITE_SUPABASE_URL=https://mock.invalid`、`VITE_SUPABASE_ANON_KEY=mock-anon-key` と
`VITE_PAYMENTS_ENABLED=false` で別outDirへビルドし、別ポートでpreviewする。
`MOCK_E2E_BASE_URL=https://localhost:4176 python3 payments_remote.py` で購入オフと付与済みの作成・質問を検証する。
trueビルドでは `MOCK_PAYMENTS_ENABLED=true` を付け、REMOTE仮付与が無効のままか検証する。
上記の架空の値はテスト専用で、デプロイ用環境変数へ保存しない。

## REMOTEの読みもの・相談元（実API形状の合成応答）

`remote_readings.py` は、異なる生年月日の本人2人×相手2人を検証する追加テスト。
見出し・年と章の本文・ふたりの年表・相談候補のURL/ID/テーマ・実年の保存キー、
読み込み中/失敗/再読み込みを検証し、REMOTE生成JSに既知の見本本文が含まれないことも確認する。
APIはすべてローカルfixtureで置き換え、外部への通信は遮断する。

```sh
cd frontend
VITE_SUPABASE_URL=https://mock.invalid VITE_SUPABASE_ANON_KEY=mock-anon-key VITE_PAYMENTS_ENABLED=false npm exec vite build -- --outDir /private/tmp/fatelab-remote-real-readings --emptyOutDir
npm run preview -- --host 127.0.0.1 --port 4192 --strictPort --outDir /private/tmp/fatelab-remote-real-readings
```

別ターミナルでリポジトリ直下から実行する：
`MOCK_E2E_BASE_URL=https://127.0.0.1:4192 python3 docs/mock-e2e/remote_readings.py`
別outDirの場合は `REMOTE_DIST` も指定する。HTTPSを使わない環境ではURLをHTTPに合わせる。
実DBの権限・実配送・実AI生成の成功を保証するテストではない。
# 旧ログインのREMOTE fixture

旧法務/SEOの `legacy_legal_seo.py` は通常の見本ビルドで実行する。Vite previewはVercel設定を実行しないため、SEOのrewriteは設定JSONと実際のdist HTMLをブラウザーfixtureで対応づける。実VercelでのURL確認は公開前に別途必要。アプリ向け保存文書はStripe料金を取得せず、保存本文・元ソースSHA256・Web文書との区別を検査する。

`legacy_login.py` は通常の見本ビルドではなく、公開用に見せかけた合成値だけでビルドして実行する。

```sh
cd frontend
VITE_SUPABASE_URL=https://mock.invalid VITE_SUPABASE_ANON_KEY=mock-anon-key VITE_PAYMENTS_ENABLED=false npm exec vite build -- --outDir /private/tmp/fatelab-legacy-auth-fixture-20261018
npm run preview -- --host 127.0.0.1 --port 4192 --strictPort --outDir /private/tmp/fatelab-legacy-auth-fixture-20261018
```

別ターミナルでリポジトリ直下から `MOCK_E2E_BASE_URL=https://127.0.0.1:4192 python3 docs/mock-e2e/legacy_login.py` を実行。実際のSupabase値や秘密鍵を入れない。外部通信はfixtureで遮断し、テスト用パスワードも合成文字列のみを使う。Googleは戻り先指定までの検証で、本番OAuth一往復の代替ではない。
