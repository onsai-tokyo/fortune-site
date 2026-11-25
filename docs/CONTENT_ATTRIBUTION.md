# FATE LAB の流入・コンテンツ・登録計測

## 対象と現在の登録導線

- GA4プロパティ：`fate-lab.com`（`532634924`）、アカウント `391047063`。
- Webストリーム：`14355610174`（宿命鑑定）、計測ID：`G-FPZ7QKTXLJ`。
- 2026-11-25にAdmin APIのストリームURLと計測IDを照合。スピ活ログのプロパティ `565078985` は使用しない。
- **現行Web版はゲスト鑑定が中心で、新規アカウント登録の公開受付はない。** `/restore` と `/legacy/login` は既存アカウント用。出生情報入力、鑑定完了、匿名利用、メール送信、確認コード入力だけを新規登録として数えない。本変更で登録受付を新設・再開しない。
- `sign_up` は、Supabase Authでメール確認済み・非匿名のアカウントとサーバーが確認し、DBで初回受領できた場合だけ送る。匿名→メール確認済みの移行にも対応する。既存の内部向け `product_events.registration_completed` や鑑定完了イベントとは別集計。
- 導入時点で確認済みの既存会員はSQLで受領済みにし、以後のログインを新規登録として送らない。導入後に初めて確認できたアカウントの初回Web観測を受領する設計で、メール確認そのものの時刻・別端末での登録経路を復元するものではない。

## 投稿用リンク

算命学の投稿例：

```text
https://fate-lab.com/tools/sanmeigaku-calculator?utm_source=threads&utm_medium=social&utm_campaign=c20261125&utm_content=p20261125_01
```

婚期の施策例：

```text
https://fate-lab.com/uranai/konki?utm_source=instagram&utm_medium=paid_social&utm_campaign=c20261125_02&utm_content=p20261125_03
```

| 項目 | 許可値・書式 |
| --- | --- |
| `utm_source` | `threads`, `instagram`, `tiktok`, `x`, `facebook`, `line`, `newsletter` |
| `utm_medium` | `social`, `paid_social`, `email`, `referral`。省略時はnewsletterならemail、それ以外はsocial |
| `utm_campaign` | `cYYYYMMDD` または `cYYYYMMDD_NN`。施策開始日＋任意の2桁連番 |
| `utm_content` | `pYYYYMMDD_NN`。投稿予定日＋2桁連番 |

日付は実在する日付だけを許可する。施策名・投稿本文・人名・メールなどの自由文字列をコードにしない。日付は投稿や施策の日付であり、生年月日を使わない。同一投稿のリンクには同じコードを使い、コードと投稿URL・内容の対応は運営の投稿管理表に残す。認証・設定・非公開鑑定のURLに投稿タグを付けない。`utm_term`、広告クリックID、対応外のsource/mediumやコードはGA4へ送らない。

## 30日保持の定義

公開ページで識別した直近の流入を、`fatelab:content-attribution:v1` というlocalStorageに流入時から30日固定で保持する。

- 新しいドキュメントへの通常遷移で、許可UTM、対応検索エンジンまたは対応SNSの参照元を識別したときに更新する。
- 対応検索エンジンはGoogle（com/co.jp）、Bing、Yahoo Japan、DuckDuckGo。SNS参照元もソース内のホスト許可リストに限る。参照元は分類のためだけに読み、生のURL・検索語は保存・送信しない。
- 新しい識別可能な流入で、流入元・入口ページ・最後に見たコンテンツをリセットする。入口自体がコンテンツなら、表示後にそのコンテンツを最後の閲覧として記録する。
- 直接再訪、サイト内移動、再読み込み、戻る・進む、認証・メール確認からの戻りでは保持した流入を更新しない。閲覧によって30日の期限は延長しない。期限切れは次回読み取り時に削除する。
- 過去の流入がなく、参照元なし・自サイト参照なら `direct / none`、判別できない外部参照なら `unknown / unknown`。参照元が隠れるアプリは特定できない。
- 同じブラウザー・同じオリジンのタブ間で共有する。認証を別タブで完了しても、受領時点の直近の観測を使う。別端末、別ブラウザー、wwwと非wwwの別オリジン、サイトデータ消去、保存制限、計測ブロックでは引き継げない。
- capture処理はwindow上で一度だけ実行する。静的コンテンツ側と計測側の読み込み順が逆でも取得結果をリセットしない。

## コンテンツと個人情報

コンテンツIDは公開台帳 `frontend/seo/lastmod.json` にある解説・計算ツール・目的別占い・相性入口の正規パス。たとえば `/guides/sanmeigaku-stars`、`/tools/day-master`、`/uranai/konki`。URLクエリ・ハッシュを含まない。トップや一覧は入口として記録できるが、最後のコンテンツを上書きしない。

`/restore`、設定、非公開の鑑定書、個人別の `/you/...`、`/couple/:id`、`/books/:id`、`/r/:token`、`/s/:id` をコンテンツIDにしない。診断結果や鑑定本文を記録しない。

「最後に見た」は公開画面が表示されたときの観測であり、読了や登録への因果関係の証明ではない。共有端末では別人の観測が混ざり、複数タブでは最後に表示した公開コンテンツが共有される。登録送信後の閲覧で過去の登録イベントを更新しない。

GA4へメール、表示名、アカウントID、入力内容、出生情報、診断結果、鑑定・相談本文、検索語、認証コード・トークン、生URLクエリ・ハッシュ・参照元を送らない。通常のGAクライアント識別子は使うが、会員IDをGAのuser_idに設定しない。サーバーも受信値をそのまま転送せず許可項目で組み立て直す。

## イベントとGA4のカスタム定義

2026-11-25、対象プロパティへ以下6項目を**イベントスコープ**で登録済み。

| パラメーター | 表示名 |
| --- | --- |
| `acq_source` | 直近30日 流入元 |
| `acq_medium` | 直近30日 流入経路 |
| `acq_campaign` | 直近30日 施策コード |
| `acq_content` | 直近30日 投稿コード |
| `acq_entry_page` | 直近30日 入口ページ |
| `last_content_id` | 直近30日 最後に見たコンテンツ |

これらを公開ページのpage_view、既存の行動・鑑定完了イベント、sign_upに付加する。コンテンツ・コードがない場合は `(none)`、引き継げる観測自体がない場合は項目なしとなる。

**GA標準のセッション参照元・メディアと30日保持の項目は別物。** 標準のcampaign_source/medium/name/contentは、識別可能な新しい流入の最初のpage_viewだけに付ける。内部移動やsign_upで30日前の値を標準セッション流入として再設定しない。生のURLクエリをpage_locationへ付けない。Measurement Protocolでは、この最初のpage_viewと同じ送信に、公式仕様のcampaign_details（source/medium/campaign/content）も付ける。登録イベントには付けない。

既存の `fl_traffic_source` / `fl_landing_group` は従来の計測用として維持する。30日保持の新しい項目と合算しない。静的ページでは個人情報を含まない分離iframe内のGoogleタグ、行動イベント・SPAは既存の自社収集APIからMeasurement Protocolで送信する。Measurement Protocolだけの利用では標準の自動収集セッション・ユーザー指標に制約があるため、下記の独自訪問指標をGA標準セッション数とは呼ばない。

## ダッシュボード

[FATE LAB｜流入・コンテンツ・登録（導入後／直近30日）](https://analytics.google.com/analytics/web/#/analysis/a391047063p532634924/edit/ABiu7qcLShima68TQYqaCw)

GA4の「探索」に作成し、対象プロパティの既存ユーザーへ読み取り専用で共有済み。表示期間の初期値は過去28日間で、30日は流入情報の保持期間を意味する。

| タブ | 行 | イベント条件・指標 |
| --- | --- | --- |
| 流入別：訪問・閲覧・登録 | 流入元・経路 | landing_visit / page_view / sign_up / self_reading_complete / couple_reading_complete を列に分け、それぞれのイベント数を表示。許可されたacq_sourceのみを表示し、導入前の未設定は除外 |
| 登録のみ：流入元・経路 | 流入元・経路 | `^sign_up$` 完全限定、イベント数 |
| 登録のみ：投稿・施策 | 流入元・施策コード・投稿コード | `^sign_up$` 完全限定、イベント数 |
| 登録のみ：直前コンテンツ・入口 | 最後のコンテンツ・入口ページ | `^sign_up$` 完全限定、イベント数 |

- 登録数はsign_upのみ。鑑定完了、メール送信、ログイン、他のキーイベントを足さない。
- 閲覧はpage_viewのイベント数（PV）。人数や訪問数ではない。
- 「訪問」は既存のlanding_visitイベント数。タブ内で開始から30分固定の計測セッションにつき一度で、GAの無操作30分セッションやユニーク人数とは一致しない。複数タブでも増えることがある。
- このダッシュボードに登録率は表示しない。登録率を作る場合は、同一期間・同一acq軸・同じユーザー集計方法を分母と分子に使う。セッション数と30日保持の登録数を割らない。登録が後日になるため、同期間の単純比率は流入コホートの転換率でもない。
- **過去の流入コード・閲覧と登録の紐付けは復元できない。** 導入前は未設定。新規定義のレポート反映にも時間がかかる。
- 検索語はSearch Consoleでサイト単位・ページ単位に集計する。個人の登録と検索語を結び付けない。

## サーバーでの登録受領と制限

`/api/analytics-signup` は本番オリジン・Host・POST・Bearerを検証し、Supabaseの `/auth/v1/user` で確認済み非匿名ユーザーを取得する。アカウントIDをリクエスト本文から受け取らない。認証トークンは自社エンドポイントとSupabaseだけに送る。

続いてユーザーの認証で `claim_signup_analytics()` を実行する。DB関数もauth.uidとauth.usersの確認状態を検証し、ユーザーIDを主キーに `INSERT ... ON CONFLICT DO NOTHING` する。成功した一件だけがサーバーからsign_upを送信できる。匿名・未確認ユーザーは受領せず、既存会員・再読み込み・再ログイン・別タブは二度目を送れない。一般のthreads-event APIはsign_up/signupを受け付けない。

配信は**最大一回**であり、配信保証ではない。受領後のGoogle障害やタイムアウトでは欠測し得る。重複を避けるため受領を巻き戻さず、後のログインで送り直さない。GA4は会員台帳の完全な代わりにはならない。保存領域や計測が遮断される場合も欠測する。運営・テストアクセスの除外は今回追加しない（従来のQAスイッチは維持）。

## 本番反映の順序

1. 対象Supabaseプロジェクトを公開Web環境変数と照合し、`backend/supabase/signup_analytics_20261125.sql` を一度だけ適用する。確認済み既存会員のベースラインも同じトランザクションで作る。
2. VercelのProductionに `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、既存の `GA4_API_SECRET` があることを確認する。秘密値をクライアント・ログ・PRへ書かない。
3. フロントエンドを反映する。API rewriteはthreads-eventとanalytics-signupをRender転送から除外する。VercelのRoot Directoryは既存のfrontend設定を使う。
4. プライバシー表記を同時公開する。GA4に新しい項目が出るのは導入後の収集から。受付停止中は登録数ゼロでも正常で、ゲスト鑑定を代わりに登録としない。

SQL未適用・設定不足のとき、登録計測だけ503で失敗し、認証・鑑定は継続する。アプリのiOS計測や鑑定ロジックは変更しない。本実装作業では本番DBへのSQL適用・デプロイは行っていない。

## 検証方法

Node 24以上、frontendでnpm ci。

```sh
npm run build
npm run test:attribution
npx playwright install chromium
npm run test:e2e:attribution
```

ブラウザーテストは全リクエストをfixtureで受け、実際の公開HTML・React・Supabase SDKを使う。投稿リンク→記事→計算→メール認証を模した別タブ→サーバー受領、再読み込み、既存会員OTPログイン、新しい流入によるリセット、Google送信ペイロードのカナリア検査を行う。Googleの配信スクリプトはfixtureに置換し、本番アカウントやGA4にイベントを作らない。Chromeを指定する場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` を使う。

SQLテストは**使い捨てローカルDB限定**。`backend/supabase/tests/signup_analytics_seed.sql` → 本マイグレーション → `signup_analytics_test.sql` の順に適用する。ベースライン・匿名・未確認・確認後の移行・権限を検証する。24接続の同時受領でもtrueは1件だけであることを確認した。

参考：[Google公式のMeasurement Protocolのセッション帰属](https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases#session_attribution)、[campaign_details](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events#campaign_details)。
