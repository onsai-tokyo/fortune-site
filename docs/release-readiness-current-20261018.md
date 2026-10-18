# 公開準備の現状と承認待ち（2026-10-18）

続報：REMOTEの実データ対応・最新テストは `remote-readings-fix-20261018.md`、販売準備中の規約整理は `legal-publication-preparation-20261018.md` を参照。以下のテスト件数・法務の仮置きに関する記述は作成時の履歴。本番Bは引き続き未実行。

## 完了範囲（ローカルのみ）

- main基準の統合、iOS/既存API/生成エンジンの保護、決済false、旧閲覧・ログイン導線、アカウント境界の修正を保存済み。元のdirty checkoutには触れていない。
- backend522件成功、frontend build・unit成功、既存mock-e2e6本と追加fixture成功の記録あり。実メール・実AI・本番OAuth・実Vercelルーティングの合格を意味しない。
- Webの `/terms` `/privacy` `/tokushoho` にPDF改訂版を反映。ユーザーが今回確定した `onsai.tokyo@gmail.com` と `山崎愛美` を追加。ユーザーは住所/電話番号の請求時開示（実対応可能）と実公開日の施行を承認。画面では請求先メールを案内し、施行を「Web版の公開日から適用」と記載。まだ公開していないので数値の日付は先に捏造せずB8時点で確定する。
- main 79da270の旧法務ソースを静的レンダーし `/app-legal/terms` `/app-legal/privacy` `/app-legal/tokushohou` に保存。元ソース3件は未変更、SHA256で対応を確認。純粋な本文を信頼済みリポジトリJSONに保持し、スクリプト・form・イベント属性なしを検査。上部の保存版説明とリンク以外は元文面を維持。旧料金取得のuseEffectは実行せず初期表示文を保存する。現デプロイ/配布バイナリとの完全一致は未確認と明示。
- iOS等の旧 `/tokushohou` はWeb用「月額なし」に置換せずアプリ向け保存文書を表示。Web用は `/tokushoho`。Webの規約/プライバシーからも保存版へのリンクを設置し、AI条項anchorを維持。
- Vercel設定から既存SEOのトップ転送を除き、生成済みguides/tools/index/info HTMLへのrewriteをSPA fallbackより前に追加。古い `/#form` CTAは `/welcome` へ変更。記事/計算エンジンは変更しない。Vite previewはVercel設定を実行しないため、追加ブラウザーテストは実設定をローカル生成ファイルへ対応づけるfixture。実ホストはB6/B7で別確認する。

## 今回のローカル検証記録

- frontend build成功、unit **87件成功**。旧法務原稿3件とiOSのmain差分0件。main保護チェック成功。
- 既存mock-e2e journey/guest/logic/bugs/probe3/crawlの6本と、legal_pages/email_otp/return_to/legacy_reading/legacy_legal_seoが成功。crawlerはno issues。保存版の見出しをh2にし、原稿のh1を重複させない修正も検証した。
- ユーザーの追加承認後、文面を再ビルドしlegal_pages/legacy_legal_seoを再確認。ログは `/private/tmp/fatelab-approved-legal-*-20261018.log`。実Vercelのrewrite確認ではない。
- backend実装は今回変更なし。直前の全件再実行結果は522件成功（`/private/tmp/fatelab-login-backend-tests-20261018.log`）。今回のfrontend検証と混同しない。

## ユーザーの判断が必要

1. **残る規約の仮置き**。メール/代表者名、住所/電話番号の請求時開示、実公開日施行は確定済み。残る契約条件等は別途確定し、編集用の注記をそのまま本番文面としない。販売準備中だけを理由に一律の義務免除とは判断しない。
2. **Webの無料質問方針**。推奨：共有FREE_QUESTION_LIMITは保持、Web UIとWeb専用APIは無料質問を提供しない。既存APIへ有効JWTで直接アクセスした際の枠までWebだけ禁止するなら、信頼できるアカウント来歴等の追加設計が必要。Origin/自己申告ヘッダーで認可を分けない。この制約は隠さない。
3. **Google復帰先の許可**。`/legacy/login` が本番SupabaseのRedirect URLsで許可されているか未確認。実設定読み取りと必要な追加は、Bの内容を報告し個別OKを待つ。旧 `/auth` 広告/旧認証callbackの完全互換は未完了。実際の広告先・ASC設定もログイン未了で未確認。
4. **最終文面の専門家確認と実端末回帰確認**。静的architectureテスト更新はiOSのデザイン・VoiceOver・配布バイナリの実確認を代替しない。

### 住所・電話番号に関する確認根拠

消費者庁は、請求時に遅滞なく情報を提供する旨を表示し、実際に対応できる体制がある場合、通販広告の住所・電話番号の表示を省略できると説明している。単に連絡手段が不要になる制度ではない。[公式Q&A](https://www.no-trouble.caa.go.jp/qa/advertising.html-8)

個人情報保護委員会の通則編3-8-1も、保有個人データに関する事業者名称・住所・法人代表者等について「本人の知り得る状態」に置くことを求め、本人の求めに応じ遅滞なく回答する方法を含むとする。無料提供でも個人情報の取扱いの義務は別に検討する。[公式ガイドライン](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/)

これらは一般的な制度の確認で、個別の文面・運用の適法性を保証するものではない。ユーザーの承認後、請求時開示の掲載方式をローカル文面へ反映済み。本番サイトは変更していない。

## B計画（全て未実行、手順ごとに説明→個別OK）

| 手順 | 実施内容と成功判定 | 戻し方・留意点 |
| --- | --- | --- |
| B1 | 直近バックアップ日時・対象・復元責任者を確認 | 読取のみ。バックアップ作成/有料機能は別承認。復元可否不明なら止める |
| B2 | 3 SQLだけをWeb credits→questions→savesの順に適用し定義/RLS/関数を照合。最初のSQLには独立ai_book_order_webを追加済み | 未commitはrollback。commit済みの追加物は原則残し、DROPで既存データを壊さない。元iOS関数/制約を比較し必要な修復は別承認。review/trial履歴・BUILD45修復SQLは禁止 |
| B3 | 元設定を記録しMagic Link/Change Email本文、匿名rate limit10/IP/時、その後匿名ON。Google復帰先が必要なら追加内容を別報告 | 本文/limit/匿名スイッチを記録値へ戻す。匿名OFFは既発行セッションの失効ではない。CAPTCHA・OTP期限/桁数・Confirm signupは触らない |
| B4 | FREEは変更しない。既存CORS許可を保持してfate-lab.comを追加。月間AI上限は既存値を保持 | FRONTEND_URLの記録値へ戻して反映。Vercel候補URLが判明後、必要なexact origin追加も別報告/承認。FREE=0という元の手順は実行しない |
| B5 | push先リポジトリ・枝・自動デプロイ影響を事前確認しreleaseブランチだけpush。Render API/workerの対象版を明示、既存iOSログイン/読取を確認 | 前のRenderデプロイへ戻す。branch/envが自動復元されると仮定せず記録と照合。main/stagingへ無条件pushしない |
| B6 | Vercelはドメインをまだ割り当てない段階デプロイ。公開VITE URL/anon/payments=falseのみ。OTP8既定、Turnstile未設定。API proxy/SEO/旧URLを確認 | 旧Productionを維持。通常のprodデプロイで先にfate-lab.comを切り替えない。skip-domainの利用可否と権限を確認する |
| B7 | 専用アカウントの匿名/引継ぎ/旧ログイン/読みもの/相手/年表、1冊付与→生成→質問2回、2アカウント隔離、退会を確認。実メール8桁/文面、決済準備中、法務/SEOを確認 | テスト失敗なら昇格しない。テストデータだけ削除。既存AI利用料が発生する実AI試験はAでは行わず、B7の承認範囲で行う |
| B8 | fate-lab.comを候補デプロイへ昇格、実URLで再確認 | 記録済み旧Vercel Productionへ即時rollback。Hobbyの直前版制約に注意。目標数分は未実測の運用見積り。Render/DB/認証設定は別に戻す |
| B9 | 版、変更点、実測結果、未確認事項を報告 | 不具合が残る場合は公開継続の判断をユーザーに求める |

旧Productionの記録は `release-preparation-20261018.md` にあるが、Bに入る時点で再確認する。B1の読み取りもユーザー指定の承認対象なので未着手。stagingは引き続き中止、追加契約・課金・秘密値の表示やコピーは行わない。
