# 10/18 Web公開準備 A1〜A4 と B実行計画（本番未変更）

## 判定

**現時点は公開不可。B1〜B9は未着手。** 決済はfalseのまま。安全な本番統合・fail=0・旧リンク互換性・実サービスの設定確認が揃っていない。「コード側のブロッカーなし」という以前の判断を撤回し、以下を優先する。

### A1：ローカル反映済み、公開用の最終確定ではない

- 元文書：ユーザー提供の `FATE LAB Web版 規約・特商法 下書き (1).pdf`。冒頭「この下書きについて」等の作業説明は除外し、利用規約15条、プライバシーポリシー11条と表、特商法表記をWeb専用ページへ反映。
- 変更は `frontend/src/web/pages/LegalPages.tsx` / `data/legalContent.ts` とWebルートのみ。既存の `frontend/src/pages/TermsPage.tsx` / `PrivacyPage.tsx` / `TokushohouPage.tsx` やiOSファイルは上書きしていない。公開URLの中身をまだ変えてはいない。
- 本番Supabase SMTPのHost欄だけをローカル判定し、値を表示・コピーせず **Resend** と確認。Password/Username/秘密キーは読んでいない。会社名 **Plus Five Five, Inc.**、国 **米国** は[Resend公式Privacy Policy](https://resend.com/legal/privacy-policy) / [データ保存国の公式説明](https://resend.com/security/gdpr)で裏付けた（Dashboardで国が表示されたという意味ではない）。
- 本番Supabase概要の表示 **Northeast Asia (Tokyo) / ap-northeast-1** を読み取り確認。保存先を **日本・東京** と記載。これだけで全委託先のデータ処理が国内限定になるとは解釈しない。
- 上記2項目以外の［ ］は依頼どおり維持。代表者・所在地・電話/メール・施行日・匿名清掃期間・Anthropic契約確認・有効期限［6か月］などは未確定。仮置きを確定値として公開しない。専門家確認も未了。
- A1コミット：`57cf854`（親 `c02119d`）。pushしていない。

### A2：統合ブランチ作成、統合と統合後テストは未完了

GitHubのmainを読み取り確認し **79da2705966908e91bf49004fad89fbc9bca9837** に固定。

- Web作業：`/private/tmp/fatelab-web-staging-20261018`、`codex/fatelab-web-staging-20261018`。
- 統合作業用：`/private/tmp/fatelab-web-release-20261018`、**codex/fatelab-web-release-20261018** をmainから作成。
- main比較用：`/private/tmp/fatelab-main-baseline-20261018`（detached main）。
- 統合ブランチで `git merge --no-commit --no-ff 57cf854` を試行し **49ファイル競合**。iOS差分は試行中もmain比較で0件。共有API・生成エンジン・Apple/無料体験等を一括でWeb側に合わせるのは危険なので `git merge --abort` で取り消した。統合ブランチはcleanな79da270のまま。未解決マージや偽の「統合済み」コミットは残していない。
- 本番mainには、Web側より新しいDeviceCheck無料体験、Apple購入応答、会員別相手枠（無料1/会員10）、カード閲覧認可、保存データのサーバー復元、ブック生成失敗処理、timelineV3等が存在する。例えばWeb版partnersの固定1枠を共有ルートへ上書きするとiOS会員の仕様を変える。Webのbook status/publicBook全置換ではtrial/failureCode等が落ちる。reading保存の全置換ではrestoreGeneratedSnapshot等が落ちる。
- 推奨：main側のiOS・エンジン・既存契約を正として保持し、Web固有の無料/購入冊数ルール・質問・必要なprojectionを加算的に統合。必要箇所はWeb専用経路へ分ける。どちらかのブランチを丸ごと優先する解決、テストskip、iOS修正はしない。この設計を確定してから実装・統合後の全件テストが必要。

#### 実行したテスト（統合後の合格ではない）

| 対象 | 結果 |
| --- | --- |
| main 79da270 backend `npm ci` → `npm test` | 512件、501成功、**11失敗** |
| main backend `npm run build` | 成功 |
| Web 57cf854相当 backend `npm test` | 598件、583成功、**既知15失敗** |
| Web backend build | 成功 |
| Web frontend `npm run build` | 成功（既存のstatic/dynamic import警告あり） |
| Web frontend全unit（lib/*.test.ts + web/data/*.test.ts） | **78件成功、0失敗** |
| mock-e2e journey/guest/logic/bugs/probe3/crawl | 6本完走、FAIL/Tracebackなし、crawler no issues |
| 追加legal_pages.py | 3ページの全見出し・委託先/地域・準備中・仮置き・390px幅・旧綴り転送が成功、pageerrors空 |
| 統合ブランチのbuild/test | **未実行：競合を安全に解決できていないため** |

比較：以前の15失敗とmainの11失敗は **共通7、Webのみ8、mainのみ4**。単なる15→0ではなく、main単体もfail=0ではない。失敗はarchitecture.test.tsのソース契約検査で、mainの11件は次のとおり。現在仕様に対して古い期待なのか、実際の回帰かは個別に判断が必要で、今回勝手にテストを弱めていない。

1. StoreKitは同期検知だけに使いプレミアム表示はサーバー状態を正とする
2. UI刷新は白黒テーマ・段階式オンボーディング・認証ゲートを維持する
3. 相性生成は個人情報を含めず停止理由と出力量を計測する
4. 相性とチャットは共通プロンプトをキャッシュし相性データを圧縮する
5. 相性鑑定はpartnersの一経路だけで生成し同じ課金判定を通る
6. 相性結果は選択画面と分離し本人鑑定と同じカード導線を使う
7. 設定から鑑定履歴を外し購入復元とログアウトを各カード内に保つ
8. 読書画面と入力・生成UIは小画面でも簡潔な表示を保つ
9. 認証画面はメール・Google・Appleを同幅の縦一列で残す
10. 5タブをenumで管理し再選択で各タブのrootへ戻る
11. App Store同期は別アカウントを除外し明示的なSandbox復元だけ移管する

ログは `/private/tmp/fatelab-main-baseline-tests-20261018.log` / `fatelab-A-web-backend-tests-20261018.log` / `fatelab-A-frontend-unit-20261018.log` / `fatelab-A-e2e-*-20261018.log` / `fatelab-A-merge-20261018.log`。テストは新規ローカルcheckoutの合成fixtureのみで、実AI/本番アカウント操作なし。元のdirtyディレクトリに触れていない。

### A3：ドメイン・既存利用・ロールバック

#### 現在のドメイン（Dashboard読み取り確認）

- Vercelチーム **onsaitokyo-4984's projects（Hobby）**、プロジェクト **fortune-site**。
- `fate-lab.com` と `fortune-site-omega.vercel.app` がProductionへ割当済み。
- 現行Production：**C3LLitpGiyrhSuJqVyLG3TGRSkTh**、URL **fortune-site-htciundaw-onsaitokyo-4984s-projects.vercel.app**。表示は10/15作成、Source=`vercel deploy`。このCLI成果物とGitHubmainの一致までは確認できていない。
- 既存のWeb previewは **EXpAcFrPKsYAphhWvx3JTCWSzTgQ**。これを現行Productionと取り違えない。
- OverviewにInstant Rollbackボタンがある。DNSを変えず同一プロジェクトの割当を戻す方式を優先。復旧操作・表示確認は**数分を目標とする運用見積もり**で、実測/SLAではない。デプロイの再ビルドやDNS変更を伴う復旧は別で、所要時間は保証できない。
- [公式Instant Rollback](https://vercel.com/docs/instant-rollback)ではHobbyは直前の本番へ戻せる。上記旧デプロイを削除せず、候補を何度も本番昇格して直前を入れ替えない。Vercelの戻しはRender/DB/メール/匿名認証を戻さない。旧ビルドのVITE値も現在値に更新されない。

#### URLと影響

| 利用元・根拠 | URL | 変更の危険と残し方の案（案のみ） |
| --- | --- | --- |
| iOS AppConfig/Settings/LegalLink、App Store提出用description/review notes | `/terms`・`/privacy` | 新Webだけの契約に置き換えると外部ブラウザ/審査で見る文面は変わる。旧アプリ用文書を専用パスへ保存し、ルート文書に版の区別とリンクを設ける案。iOSにはローカルJSONの法務表示もあり、LegalLinkは同ホストのこの2パスをアプリ内表示へ振り分けるため、全表示がWeb差し替えで変わるわけではない。配布バイナリとの一致は別確認 |
| iOS AISharingConsentView | `/terms#ai-consultation` | WebのAI条項に同じanchorを保持済み。ただしWeb/iOSのAI利用範囲の文面は別途確認 |
| iOS Settings | `/tokushohou`（旧綴り） | 現在HTTP200、`/tokushoho`は404。新Webは旧綴り→新綴りの転送を保持。月額会員等iOSの販売条件までWebの「月額なし・準備中」に変えてしまわないよう、アプリ向け表記も別保存が必要 |
| iOS問い合わせ・旧サイト | `/contact`、`/support` | contact→support転送はあるがsupport本文は旧プラン案内とsupport@fate-lab.com。新規約の未確定問い合わせ先と整合させる必要あり |
| iOS READMEのApp Store Server Notifications V2設定手順 | `/api/apple/notifications` | 現行のRender宛proxyを必ず保持。ASC実設定は未確認であり、READMEだけで「現在もこのURL」と断定しない |
| Meta広告手順書（meta-ads-playbook.html） | `/auth?mode=register`、トップ | 現行HTTP200。新Webはトップへの転送になるため404は避けられても従来の登録導線とは変わる。広告の説明・遷移先と整合確認が必要 |
| 旧Webの履歴/共有 | `/reading/:id`・`/r/:secretToken`・`/s/:shareId` | mainに旧閲覧/共有ルートがあるが、新Webの一括リダイレクトはトップへ送る。**リンク機能が失われる**。既存ルート/認証/権限付き閲覧を残すか、同等の互換ハンドラーを追加する案。トークンをログ/Analyticsに出さない |
| 旧SEOコンテンツ | `/guides/*`・`/tools/*` | 現行guideサンプルはHTTP200。新Vercel設定はトップへ転送するため内容/検索流入が変わる。静的ページを残すか別途方針決定 |

App Store Connectはログイン画面、Meta Ads Managerもログイン画面のため**現在の実設定は未確認**。上表はコード・リポジトリ内提出資料・広告手順書に基づく。実アカウントへ入るための秘密情報は要求/入力していない。ログイン後の読み取り確認か、担当者の設定確認が必要。

公開サイトへのGETで `/` `/terms` `/privacy` `/tokushohou` `/contact` `/auth?mode=register` `/guides/day-master` は200、`/tokushoho` は404。`/r/example`もHTTP200だったがSPAのHTTP200は有効な共有/閲覧の機能成功を意味しない。実ユーザーのトークンは使っていない。

#### FREE_QUESTION_LIMIT=0 はiOSへ影響する

main `backend/src/routes/reading.ts` の `FREE_QUESTION_LIMIT` は既定2。`GET /api/reading/status` のlimit/remainingと、質問の `begin_reading_question` に渡す **非会員の p_free_limit と p_user_limit** に共通で使われる。iOS `APIClient.swift` はこのstatusと `/api/reading/conversations/:id/questions` を利用する。

よって現行値が2なら0にすると、**iOS非会員の新規質問も0回になる**。会員は別の月間枠、ブック質問はWeb側で別の月間枠を使うが、これを根拠に「iOSに影響なし」とは言えない。本番環境変数の現在値自体は今回表示/変更していない。

**B4のFREE変更は実行不可。推奨は共有値を保持し、Webの読みもの質問をWeb専用経路/サーバーポリシーで別制御すること。** クライアントが自由に付けられるOriginや任意ヘッダーだけでiOS無料枠と区別し、認可を緩めない。Web UIに入口がないだけでは、共有APIを直に呼べることへの制御にならない。

#### B5〜B7の追加落とし穴

- mainへpushするとVercelの自動本番デプロイを誘発し得る。B5は**統合releaseブランチのみpush**し、Renderへの反映を明示的に管理する。mainへ無条件pushしない。既存stagingブランチへpushもしない。
- 同じVercelプロジェクトで通常の本番デプロイをするとB6時点で既存ドメインまで動く。[公式CLI](https://vercel.com/docs/cli/deploy#skip-domain)の **`vercel --prod --skip-domain`** で段階デプロイし、B8だけでpromoteする案。CLIのログイン状態/利用権限は未確認。秘密トークンをコピーする方法は使わず、必要なログインは担当者が行う。
- B6の3環境変数だけではAPI接続が未定義。WebのAPI_BASEは `VITE_API_BASE_URL ?? ''` だが現行frontend/vercel.jsonのproxyはApple通知だけで、一般 `/api/*` の転送がない。**同一originの一般API proxyを追加**するか、追加の公開用 `VITE_API_BASE_URL` を設定する必要がある。今回勝手に追加設定していない。
- Vercel固有URLで試すB7では、Renderの既存CORS許可を保持しつつ当該originも必要。FRONTEND_URLをfate-lab.comだけに置換すると既存許可を落とし、previewも許可できない。exact originを追加し、不要になった確認用originは後で承認して除く。

## B計画：全手順、直前の内容説明→個別OK待ち（未実行）

下記はブロッカー解消後の案。B7も本番データ操作なので個別OKが必要。永久削除は専用テスト対象を再特定して直前承認を得る。

| 手順 | 実施・成功条件 | 失敗時/ロールバック |
| --- | --- | --- |
| B1 | **OK後に初めて**本番バックアップ画面で直近の完了日時/対象/復元方法を確認。未作成/古い/復元不可なら停止。課金や新サービス追加はしない | 読み取りのみなので戻す変更なし。不十分ならB2へ進まない |
| B2 | OK後、現行制約定義・適用履歴を保存し、未適用のweb_book_credits → ai_book_questions → reading_savesだけを適用。review/trial付帯条件、RPCの存在/権限、所有者RLS、削除連動を確認。10/7・10/8履歴SQLやBUILD45修復SQLは禁止 | 未commit分はROLLBACK。commit済みの追加テーブルをDROPしない。SQL適用済み一覧を特定し停止。定義修復/バックアップ復元は別承認 |
| B3 | 現行2テンプレートを保護された管理環境で退避し、OK後に8桁版へ変更。別のOKで匿名作成10回/IP/時間、別のOKでAnonymous ON。RLS再確認と確認用UID間分離を条件にする。OTP8/3600秒・Confirm signup・CAPTCHAには触れない | テンプレートを退避版へ。新規匿名ログインをOFF、rateを記録旧値へ。OFFだけでは既存匿名セッションは失効しない。既存セッションの対処は別承認 |
| B4 | **現依頼のFREE=0はiOS影響があるため保留**。Web専用制御を先に実装/検証してから再提案。CORSは既存を残しfate-lab.comと確認用exact originを追加する案 | 変更した非秘密設定を記録旧値へ戻し再デプロイ。秘密キーを表示しない。iOS既存枠を変える案は採らない |
| B5 | 統合後全テストfail=0、iOS差分0、共有API契約の互換性が条件。OK後にreleaseブランチのみpush、対象SHAを指定してRender API/workerを互換な版へ反映。/healthと既存iOSログイン/保存済み読みものを担当端末で確認 | API/workerを事前記録の成功コミットへ戻す。環境変数はコードrollbackで戻ると仮定しない。mainの強制pushなし。Renderの旧成功deployment/コミットはB5前に読み取り再記録 |
| B6 | API経路・CORS・認証設定が揃った後、OK後にproduction環境でSupabase公開URL/公開anon、PAYMENTS_ENABLED=false、OTP未設定=8、Turnstile未設定を確認し `--prod --skip-domain` 等の段階デプロイ。API_BASE/proxyの追加方針は先に承認を得る。fate-lab.comがC3LL…のままか確認 | 切替していなければ旧ドメインは無変更のまま。不合格成果物を昇格しない。誤って切替した場合は即時rollbackを別途確認して実行 |
| B7 | OK後、本番に専用2アカウントで匿名開始、読みもの/年表/相手登録→入替、実配送8桁コード引き継ぎ。専用アカウントへ1冊だけ付与し作成→届く→質問2回→残0/回0、3回目拒否、購入入口準備中・模擬付与なし、規約3ページと所有者間取得/更新拒否。メール/OTP入力は担当者が行い、コードやトークンをログに残さない。2件のテスト対象だけ明示して退会を直前承認 | 失敗したらB8へ進まない。operationId不明のまま二重作成/再付与しない。専用テストデータのみを承認して清掃。実ユーザーは触らない。退会は不可逆 |
| B8 | 全ブロッカー解消/専門家・会社情報確定/受入合格後、対象IDと旧C3LL…を提示しOK待ち。DNSは変えず候補deploymentをpromoteし、トップ/規約/引き継ぎ/Apple通知proxy/旧リンクを確認 | 問題時はVercel Instant Rollbackで旧C3LL…へ（Hobbyの直前条件を先に再確認）。Render/DBへの影響が残るならそれぞれ別手順。数分を復旧目標とし所要時間を保証しない |
| B9 | deployment/SHA/非秘密設定差分、試験結果と未確認事項を報告。購入はoffのまま、旧成功成果物を保持 | 未完了を公開完了扱いにしない |

## 次に必要な判断

1. 本番mainの機能を保持してWeb機能を加算統合する方針（49競合・API互換性・既存11失敗の原因調査を含む）を確定する。既存iOSのソース変更やテスト緩和は不要という意味ではなく、してはいけない。
2. FREE_QUESTION_LIMIT=0は実行せず共有枠を保持、Web専用制御を設ける案を推奨。
3. iOS向け法務文書・旧閲覧/共有URL・広告/SEOリンクを残す設計と、実App Store Connect/広告設定の読み取り確認。
4. 法務の［ ］と専門家確認。単にWebファイルへ入れたことを公開承認としない。

本番バックアップ画面、SQL適用、Auth/Render/Vercel設定、デプロイ、push、課金、実AI、実メール送信、実アカウント作成/削除は今回実行していない。A4で停止する。
