# OTP桁数対応・本番RLS確認の作業結果

対象ブランチ：`codex/fatelab-web-staging-20261018`。親コミット：`2c2829f`。元のdirty作業ディレクトリ・iOSファイルは変更していない。

## 実装

- `VITE_EMAIL_OTP_LENGTH` は未設定/空なら8、明示値は6〜10の整数のみ。誤設定は黙って別桁数にせずエラーとする。これは公開用ビルド設定で秘密ではない。設定変更時は再ビルドが必要。
- メール登録・別端末引き継ぎの入力上限、案内、ラベル、エラー、送信ボタンを同一値へ統一。先頭ゼロを保持し、ASCII数字のみ受理する。サーバーのverifyOtpによる正当性・期限判定は維持。
- 本番8桁/1時間とstaging6桁/10分で画面文言が矛盾しないよう、有効期限は「メールに記載された有効期限内」と案内。
- Magic Link/Change Email Addressの文面案を8桁・1時間・リンクなしに更新。Confirm signupは対象外。本番へは未設定。
- 本番17件のRLSと実効権限・実行可能な通常SECURITY DEFINER RPC2件の所有者検証を読み取り確認。全件本人UID条件で、認証ロールだけの全体許可なし。`is_anonymous`除外もないため、本人データの保存・共有等は匿名にも認める定義。詳細と限界は `production-anonymous-rls-audit-20261018.md`。
- prelaunch-checkにRLS再確認 → 匿名作成10回/IP/時間 → 別途承認後に匿名ログインON、成功確認と戻し方を追加。今回はどの設定も変更していない。

## 検証

1. `./backend/node_modules/.bin/tsx --test frontend/src/lib/emailOtp.test.ts frontend/src/lib/turnstile.test.ts frontend/src/lib/safeReturnTo.test.ts`：9件成功。デフォルト8、6〜10切替、誤設定拒否、不正コード拒否、先頭ゼロ、既存Turnstile未設定/戻り先の検証を含む。
2. frontend `npm run build`：成功（TypeScript + Vite + SEO生成）。既存のSupabase静的/動的import警告は残る。
3. `VITE_EMAIL_OTP_LENGTH=6 vite build --outDir /private/tmp/fatelab-otp6-dist-20261018`：成功。1の型チェックと同じソースを別設定でバンドル。stagingサービスへは反映していない。
4. 新しいデフォルト8桁ビルドをローカルpreview 4188で確認。mock-e2e既存6本（journey/guest/logic/bugs/probe3/crawl）完走、FAIL/Tracebackなし、crawlerはno issues。pageerrorsを出す4本は空配列。他の2本も異常なし。
5. `email_otp.py`：8桁/6桁ともPASS（案内、ラベル、maxlength、不正桁数のエラー、数字フィルター、先頭ゼロ、成功）。`return_to.py`：8桁/6桁ともPASS。staging相当6桁ビルド（preview 4189）のguestも全OK、pageerrors空配列。
6. `git diff --check`：成功。

UIテストはローカル見本の合成データで、実メール・本番匿名アカウント・AIは使用していない。初回の追加OTPテストはDemoボタンのaccessible nameにパスも含まれることによるテスト側の完全一致セレクターでタイムアウトし、セレクターを直して6/8両方で再成功した。単体テスト/Chromium/previewの起動にはOS sandbox制限のため承認済みの制限外実行を使用した。

backend/iOSは無変更のためbackend全件テストは今回再実行していない。既存15件の版不整合という前回結果を「今回も全件通った」とは扱わない。本番取り込み後にfail=0を確認する公開条件は維持。

## 未実行

push、デプロイ、本番/staging設定変更、メールテンプレート適用・メール送信、匿名ログインON、課金、実AI・本番E2E、利用者データ変更・削除はしていない。OTP設定8/3600秒・SMTP有効はDashboardで読み取り確認しただけで、配送成功は未検証。公開時にはRLSの再確認・2UID間分離・実配送・既存iOS回帰確認が必要。
