3 SQL限定の事前確認・巻き戻し準備（2026-10-19）

最新（同版方式）：ユーザー承認により matched_runtime.py を追加。公式配布物
postgres-17.6.1.106 の initdb(supabase_admin)→Unix socket起動→未変更の公式
share/supabase-cli/migrations/migrate.shで初期化SQL/マイグレーション全件を順に適用する。
ロールのリネーム・ロールdumpの編集/再生・関数の推測作成・エラー無視はしない。
Postgres17.6、auth.uid/auth.users、service_role、pg_graphql1.5.11を確認する。
外部TCPをOS sandboxで遮断し、TCP待受なし。秘密値の環境変数は引き継がない。
公式初期化の直後に作業を止める合成スモーク試験は成功・停止確認済み。
matched_rehearsal.pyは従来と同じ4表/IDだけのauth親データ/3SQL/逆SQLの試験を
この起動方式で行い、保存済み本番構造との一致を確認してからデータ投入へ進む。
余剰のanon/authenticatedの表ACLだけを狭く取り除き、他の差は停止する。
COPYデータ比較はtimestamptzだけをUTCの同一時点へ正規化し、その他の値は厳密比較。
これは+09と+00の同一日時の表記差のためで、誤差許容やデータ項目の除外ではない。
Mac標準Python3.9で関連43件成功。合成データの matched_integration は
20261019-03 で全工程SCOPED_REHEARSAL_OK、server_stopped=true。
実バックアップを使う同版の再リハーサルは、ここに記載する時点ではまだ未実施。
本番のSQL適用・再接続・設定変更・pushもしていない。

続報：本番の読み取りB0はユーザーが実行し、B0_DIFFERENCES_STOP。
オフライン診断では4表のACLにローカルだけのanon/authenticated向け過剰GRANTがあり、
列・制約・ポリシー・業務トリガー等には差がない。その他の差は拡張機能。
本番はPG17.6 / pg_graphql1.5.11、初回リハーサルはPG17.11でpg_graphql未導入。
この差を無視して合格にしない。本番ACLを変更してローカルに合わせることは禁止。
local_rehearsal_acl.pyは記録済みの狭い差だけを取り除くSQLの計画器で、接続・実行しない。
未知の役割・権限・grant option・非ACLの差や、本番に残す権限があれば拒否する。
関連Pythonテスト41件成功。実データの再リハーサルはまだ未実施。

同版候補の公式配布物postgres-17.6.1.106-darwin-arm64.tar.zstをダウンロードし、
公式SHA256SUMSの0a69131156a2b1efecdda52a91cd48a96f3ab4faae752f6d01c435fe0a1e6796と一致。
postgres --versionは17.6、pg_graphql.controlのdefault_versionは1.5.11を確認。
同時に調べた17.6.1.175はpg_graphql1.6.2なので本番同版として使わない。
現在のCLI2.121.0は通常のmajor_version=17を17.11へ解決する。既存キャッシュを
旧版バイナリで上書きしたり、manifest/版表示を偽装したりしない。
公式旧版の初期化経路を確定し、実データの前に合成データで検証する必要がある。
ここまでの調査・ダウンロード・計画器テストで、本番に再接続していない。
暗号化ディスクの開錠・実データ読取・DB起動・本番SQL適用も行っていない。

状態
これは準備用ソースです。本番接続・適用・リハーサルの成功記録ではありません。
preflight.sqlは本番ではB0の個別OK後だけ実行します。
逆SQLの.inは未展開テンプレートで、そのまま実行できません。
本物の事前スナップショットから生成した逆SQLも、リハーサル完了まで本番使用禁止です。
現在の基準Webコミットは97258dd。この追加ファイル群はローカル未コミットです。
旧FATELAB_Restore_Test/Resume等は中止した全体復元用で、再実行しません。
失敗した暗号化ディスクは、ユーザーのOKなしで削除しません。

本番で変更する3本（まだ適用しない）
1. ../web_book_credits_20261017.sql
2. ../ai_book_questions_20261017.sql
3. ../reading_saves_20261017.sql
10/7 review、10/8 trialの履歴SQL、BUILD45修復SQLは本番で実行しません。

A1: 逆SQL
generate_rollbacks.pyはDB接続なしで、A2のJSONから3本を生成します。
生成場所は暗号化領域内に限定し、共有ZIPやチャットへ入れません。
コマンド例は手順説明のみ（未実行）:
  python3 -B generate_rollbacks.py <暗号化内baseline.json> <暗号化内の新規rollbackディレクトリ> --confirmed-encrypted-output
--confirmed-encrypted-outputは操作者の確認フラグで、暗号化を自動検証する機能ではありません。
スナップショット自体の改変検知・本番B0との照合は別途必要です。
生成物には元スナップショットのSHA256を付け、既存出力フォルダを上書きしません。

戻す順序は03 reading_saves → 02 ai_book_questions → 01 web_book_credits。
適用を確実にコミットしたファイル分だけ、1本ずつ個別承認して戻します。
各ファイルは独立のbegin/commitで、ON_ERROR_STOPが必須です。
FATELAB_ROLLBACK_APPROVED=trueの明示がないと、逆SQLは実行前に終了します。
このフラグは人間の個別承認の代替ではありません。

データを消さないためのガード:
- 元からあったreading_saves/ai_book_questionsには対応を推測せず、生成時点で停止。
  本番に存在した場合は個別計画を再承認。既存テーブルをDROPしません。
- 新規作成した2表も、行が1件でもあれば逆SQLは停止。無断で行を消しません。
- Webの付与行が存在したら制約を狭めず停止。既存行をDELETE/TRUNCATEしません。
- DROPはRESTRICT。依存をCASCADEで消しません。対象外の依存があれば停止します。
- ロールバック前にWebの書き込みを止め、対象テーブルをロックして行の増加を防ぎます。
  本番のAPI停止や書き込み制限も別途承認が必要です。ロック待ちは5秒で中断します。
- 新規表に作成済みのデータを残したい場合、暗号化退避と整合性の確認が先に必要です。
  今回の逆SQLは利用開始後のデータを自動救済する仕組みではありません。

戻す対象:
- grantsの元制約定義・コメントをスナップショットからそのまま復元。
  review/trialの環境・署名・transaction_id条件を推測で書き直しません。
- 対象関数が既存なら定義・所有者・EXECUTE権限/付与元・コメントを復元。
  存在しなかった関数だけ削除。旧4引数beginも存在した場合だけ定義を復元します。
- partnersの同名トリガーが既存なら定義・有効状態・コメントを復元。
  対象外の既存トリガーには触れません。
- テーブルに付属する新規ポリシー/インデックスは、新規表のDROPで取り除きます。

既存関数のACLについて:
権限を省略した--no-aclやpg_proc直接更新は使いません。
元grantorにSET ROLEできない、ACLのNULL/明示表現が元と違う、依存等で復元できない
場合は「完全一致」と扱わず停止。rehearsalのbefore/after照合で検出します。
現時点では生成器の単体テストだけであり、この挙動を実DB検証済みとは言いません。

A2: 事前読み取りSQL
preflight.sqlはBEGIN READ ONLY、pg_catalogのみを検索、30秒のタイムアウト。
対象ユーザーデータ・秘密値・ロールのパスワードを照会しません。
制約/対象7関数/6表の列・制約・インデックス・RLS・ポリシー・ACL・トリガー/
PG版/拡張版/部分復元対象4表の外部キーをJSONで記録します。
関数定義やコメントに万一秘密が埋め込まれていても、チャットへ丸ごと表示しません。
本番ではB0の内容説明とOKが必要。接続情報の取り扱いもこれまでの方針を維持します。
保存先は暗号化領域内。psql -X -qAt -v ON_ERROR_STOP=1で実行し、出力を保存。
この例を理由に、本番へ自動接続しません。

旧4引数関数の依存はpg_dependだけではPL/pgSQLの動的呼出し、外部サービスや
古いAPI利用まで網羅できません。依存なしを「誰も使わない」と断言しません。
リポジトリの現行webBooks.tsは6引数RPCを使用。実本番・外部利用はB0後に別途確認。

A3/A4: 実バックアップでは未実施。実行系の合成試験は成功（続報参照）
- ユーザーは「元と既存作業用の2ディスクを各1回開錠」を承認済み。
  元は読み取り専用。作業用には毎回attempt-UTC/を作り、既存DB/試行を再利用しません。
- 元ダンプのpg_restore --listのヘッダでPGメジャー版を決めます。まだ未確認です。
- 正式なSupabase CLI初期化を使います。素のinitdb＋推測したauth.uid()は不可。
  配布物のsupabase-postgres-init.shだけではCLI全体の初期化と同じと仮定しません。
- ロールの名前やバックアップのロールファイルは変更しません。
- データ・ログ・DB・状態ファイルは暗号化内。クラウドstagingには接続しません。
- Supabaseの初期ロール、extensions、auth.uid()、auth.usersの存在と版を検査。
- publicだけスキーマ復元。--verboseログは暗号化内。失敗TOCと欠落関数シグネチャ
  等のDDLエラーは、秘密値を含まないことを確認して表示可能。COPYエラーは伏せ字。
  DDLだから必ず秘密値がないとは仮定しません。DDL本文全体を出力しません。
- 復元に失敗したら推測した関数を作らず、エラーを無視せず停止。
- 構造baseline.json取得→逆SQL生成→3本順に適用→状態確認→各再適用の状態比較。
  web_book_creditsとreading_savesは成功して不変ならよく、失敗を必須にしません。
  ai_book_questionsは2回目がエラーになり、全体がロールバックして定義不変を確認。
- 各ファイルは元からbegin/commitを含みます。psql --single-transactionとの二重
  ラップで、後続の別ファイルや検証まで一括原子性があると誤解しないでください。
  本番では要求どおり1ファイルずつ、ON_ERROR_STOP=1で実行・直後確認します。
- 部分データ復元、partner削除トリガー動作を試験後、テストをROLLBACKしてから
  逆SQLを03→02→01で適用し、preflightを再取得して構造完全一致を確認。
- compare_snapshots.pyは日時/接続DB名/操作者だけ比較対象外。差分があれば停止。
  本番B0と別環境の比較では内部FKトリガー名等の自動採番も区別し、期待する対象
  オブジェクトの定義・PGメジャー・拡張版を照合。機械的なOID差を無断で無視しません。
- 終了・失敗時はサーバー停止を確認して取り外し。停止確認できなければ成功扱いにせず
  暗号化領域を強制detachしない。途中試行を自動削除しません。

部分データ復元の範囲案（まだ実施しない）
指定4表: public.ai_book_grants / ai_book_credits / ai_books / partner_profiles。
リポジトリの定義ではgrants/books/partnersはauth.users(id)を参照し、creditsは
grantsとbooksを参照します。ai_books.source_idは初期定義では外部キーではありません。
本番に別の外部キーがある可能性は、ダンプ/事前照会で確認するまで排除しません。

推奨案:
- 4表は実バックアップのデータを暗号化リハーサル内だけへ復元。
- auth.usersの本物の行（メール/認証情報等）は復元しない。
  4表が参照するIDだけを持つ試験用親行を作る。その他の項目は正式スキーマの既定値。
  authの復元試験とは呼ばず、4表の部分復元と外部キー確認のためのfixtureと明記。
- 必須列に既定値がない、新たな親表を要求される、未知のトリガーで失敗する場合は停止。
  実ユーザーの認証情報や別表データを黙って追加復元しません。
- ユーザーは2026-10-19に、4表の実データ＋IDだけのauth.users試験用親行の案を承認。
  ただし実バックアップのリハーサルはまだ実行していません。
- 参照整合性を避けるためのsession_replication_role=replicaやFK無効化はしません。
  COPY中だけ4表のユーザートリガーを停止し、既存の業務イベントを再発火させない
  方式を採用。理由と戻し方は実行前にユーザーへ説明済みです。内部FKトリガーは
  常時有効で、COPY順は外部キーの親→子に並べます。循環依存なら停止します。
  元のユーザートリガー有効状態は同じトランザクション内で正確に復元します。
- 実データの件数/ハッシュ等は暗号化内で比較し、チャットには成功/失敗だけ出します。

本番B0/適用へ進めない条件
- 版不明/リハーサルとメジャー不一致/拡張や依存の不一致
- 対象オブジェクトが一部存在、元制約不一致、旧関数の利用/依存が未確認
- 逆SQL未検証、元定義・権限・既存トリガーが一致しない
- 部分復元/partner削除トリガーの確認が未完了または失敗
- 元バックアップとB0の間に構造変更がある、または直前再照合できない
- 承認者が不在。B0の読み取りさえ事前OKなしに実行しない

この範囲の成功はDB全体の復元、Storage/Auth/Vaultの復旧を保証しません。
公開後の全体DR計画・自動バックアップ整備は別課題として残します。

検証
python3 -B -m unittest -v test_generate_rollbacks.py
2026-10-19: 生成/拒否/引用/比較など17件成功。実DB・本番・ダンプの試験は未実施。
この準備だけで「3 SQLが確実に戻せる」とはまだ報告しません。

2026-10-19 続報（この節を優先）
- 単体テスト30件成功:
  python3 -B -m unittest -q test_generate_rollbacks.py test_scoped_rehearsal.py
- 正式なSupabase CLI2.121.0 native/Postgres17.11で、実データなしのDDL試験成功。
  旧4引数関数のある場合も、3本適用/再適用/相手トリガー/逆SQL後の構造一致を確認。
- 架空のreview/trial付与・ブック・クレジット・相手を入れたcustomアーカイブで、
  新しいscoped_rehearsal.pyの通し試験に成功。publicスキーマ復元、4表のCOPY、
  件数/ハッシュ、外部キー有効、3 SQL適用/再適用、service_roleでの相手削除、
  逆SQL後の構造一致、4表のデータ不変を確認。partner_profilesのRLSも有効な条件。
- Mac sandboxのIP許可は方向別。外向きTCP拒否を接続テストで実測確認。
  実行のたびにもガード確認し、確認できなければ実データの復元前に停止。
- テストで起動したDBの停止を確認。実本番・実バックアップはまだ未使用。
- 再現用テストはtests/native_integration.py。新しい空の作業先を指定し、
  必要な公式CLI/公開artifact cacheを引数で渡す。実バックアップは入力しない。

実バックアップ用の新しい入口
- scoped_rehearsal.command.inをこのMac用に展開したものを使用。
  /private/tmp/fatelab-scoped-helper-20261019.qGlHHm/FATELAB_Scoped_Rehearsal.command
- 旧Test/Resumeフォルダとは別。新しい入口はこの1本だけ。
- 元はreadonly、作業用は既存の暗号化ディスク。attempt-UTC/は毎回新規。
  古いDBを続行せず、ロールの名前・ロールファイルは変更しない。
- コードと3 SQLのSHA256を開錠前に確認。イメージが既に開いていたら停止。
- 安全なsummary.jsonとcleanup.status.txtだけ外側に保存。
  COPYデータ、元スナップショット、逆SQL、CLI/SQL生ログは暗号化内に保存。
- 終了時のserver_stoppedとdetach結果が両方成功しなければ成功扱いにしない。
  停止を確認できないときは強制detachしない。古い/失敗ディスクは削除しない。
- 限定リハーサルが成功してもB0の本番読み取りは別途説明・OKが必要。

2026-10-19 日時比較の続報（以前の入口よりこの節を優先）
- 実バックアップの同版試験はCOPY_TIMESTAMP_CANONICALIZATION_UNSUPPORTEDで停止。
  本番接続なし、17.6/拡張/記録した本番構造の一致まで確認。server_stopped=true。
- Mac標準Python3.9で、小数秒1/2/4/5桁がfromisoformatに拒否されることを合成値で再現。
  PostgreSQL timestamptz比較時のみ末尾ゼロを補い6桁化。丸め・切捨て・実データ変更なし。
  実データの失敗値は表示していないため、実バックアップでの解消は再確認待ち。
- Python3.9単体44件と合成通し試験成功（小数秒1/2/4/5桁をfixtureへ追加）。
  /private/tmp/fatelab-matched-integration-20261019-04/attempt/summary.json
- 現在の所有者用入口：
  /private/tmp/fatelab-matched-rehearsal-20261019.IP3JfY/FATELAB_Matched_Rehearsal.command
  同じ暗号化ディスク内の新規attemptだけ使用。旧試験やイメージは残す。
  この入口のコードSHA256を上記修正に合わせて更新済み。

2026-10-19 本番適用前後の記録
- 同版の実バックアップ試験はSCOPED_REHEARSAL_OK。構造・4表・適用/再適用・
  相手削除・逆SQL後の構造/データ一致を確認し、終了/取り外しも成功。
- 再B0はB0_MATCH（17.6、changed_sections=[]）。本番構造のみ読み取り。
- 所有者の個別承認後、Web冊数SQL1本目の起動ファイルを実行したが、
  CATALOG_QUERY_TIMEOUT、committed=false。成功扱いにせず本番再接続/再実行は停止中。
  確認した外部結果の時刻は13:18。SQL2/3、Auth/環境変数、pushは未実行。
- 接続クライアント18.4とローカル17.6の差を切り分けるため、18.4でも合成試験。
  適用成功と、比較失敗時の接続切断によるロールバックを確認（-test-20261019-02）。
  版の差だけではタイムアウトを再現できず、保存済み記録のオフライン診断待ち。
- 診断ツールは停止段階/固定エラー分類だけを出す。実ログや利用者データは表示しない。
  現在の関連単体テスト53件成功。本番再実行は原因と手順の説明・個別OKが必要。

2026-10-19 14:05以後（この節を優先）
- 保存済み失敗記録の診断：WAITING_POST_APPLY_SNAPSHOT、NO_KNOWN_ERROR_MESSAGE。
  SQL送信後の結果取得待ちで停止。正確なタイムアウト原因は未特定。
- 別途承認された本番読み取りは14:05にB0_MATCH。適用前と対象構造が一致し、
  失敗した適用試行の変更が本番に残っていないことを確認。取り外しも成功。
- apply_web_credits.pyを静的SQLファイル方式へ変更（本番再実行は未承認・未実行）。
  --single-transaction / ON_ERROR_STOP=1、適用前後のカタログ比較をDB内で実行し、
  不一致をRAISE EXCEPTIONにして確定前に停止する。標準入出力の途中の往復待ちは廃止。
  比較用関数はpg_tempだけに作り終了前に削除。公開関数や既存iOS APIに変更なし。
  lock_timeout=5s、statement_timeout=30s、idle_in_transaction_session_timeout=60s。
  通信断などで結果が不明ならcommitted=null、再読必要として停止（成功扱いしない）。
- 単体55件成功。psql18.4/架空データで、適用前版違い、適用後の制約/関数/表/
  拡張/FK差分の拒否・ロールバックと、正常適用・別接続からの構造一致を確認。
  /private/tmp/fatelab-apply-web-credits-test-20261019-03
- 旧適用起動ファイルはコードハッシュ不一致で停止する。再実行しない。
  新方式での本番再適用は、内容を説明し個別のOKを受けてから。

2026-10-19 2本目の個別承認後
- 1本目の本番適用はWEB_CREDITS_APPLIED_VERIFIED、committed=true。
  V2の外部結果と取り外し完了を確認。3 SQLのうち本番反映済みは1本目のみ。
- 質問SQL2本目への個別OKを受領。専用入口apply_book_questions.pyを作成。
  1本目成功レシートと、after-1の構造を必須にし、after-2へ一致した場合だけ確定。
  旧4引数関数の有無も事前構造に含め、予想外なら適用前停止。
- 合成データ/psql18.4で2本目の不一致時ロールバックと成功・別接続照合を検証。
  /private/tmp/fatelab-apply-web-credits-test-20261019-04
- 単体56件成功。2本目の本番実行は所有者のパスワード入力待ち。
  /private/tmp/fatelab-apply-book-questions-20261019.pGF0AM/FATELAB_Apply_Book_Questions.command
  3本目、Auth設定、環境変数、pushは未実行。

2026-10-19 3本目の個別承認後
- 2本目の本番適用はBOOK_QUESTIONS_APPLIED_VERIFIED、committed=true。
  保存された外部結果と取り外し完了を確認。1・2本目まで本番反映済み。
- 3本目への個別OKを受領。apply_reading_saves.pyは3本目だけを指定する入口。
  1・2本目の成功レシートとafter-2を必須にし、after-3一致時だけ確定。
- psq18.4/合成データで、3本目の照合失敗時ロールバック・正常確定・別接続照合、
  service_role相手削除で該当保存だけが消えることを確認（試験削除はROLLBACK）。
  /private/tmp/fatelab-apply-web-credits-test-20261019-05
- 単体56件成功。3本目本番実行は所有者のパスワード入力待ち。
  /private/tmp/fatelab-apply-reading-saves-20261019.REpXdy/FATELAB_Apply_Reading_Saves.command
  認証設定、環境変数、push、デプロイは未実行。

2026-10-19 SQL完了・最初のメール変更
- 3本目もREADING_SAVES_APPLIED_VERIFIED、committed=trueと取り外し完了を確認。
  許可された3 SQLだけ本番反映済み。過去SQL/修復SQLは実行していない。
- 別途承認を受けMagic Linkの件名・本文だけDashboardで変更し、保存成功を確認。
  変更前文面と証跡はdocs/release_20261019/。実メール送信はまだ行っていない。
  Change Email Address、匿名ログイン、回数制限、OTP期限/桁数、Confirm signup、
  CAPTCHA、SMTP、環境変数、push、デプロイは今回変更していない。

2026-10-19 Change Email Address完了
- 個別OKを受け、Change Email Addressの件名・本文だけを本番Dashboardで保存。
  保存成功、8桁/1時間/Token変数/旧新両メールの注意文、リンクなしをプレビュー確認。
  変更前件名はConfirm Email Change。元本文と証跡はdocs/release_20261019/。
- 実メール配送/旧新双方での確認は未試験。Secure email change・OTP設定・
  Confirm signup・CAPTCHA・SMTP・匿名サインイン/回数制限には触れていない。
  認証設定の次の作業には別途個別OKが必要。

2026-10-19 匿名サインイン設定完了
- 回数欄がOFF時はdisabledだったため、匿名ON→直後に10/IP/時の順を説明し承認を受領。
  Providersで匿名ONだけ保存、Rate Limitsで匿名30→10だけ保存成功。
  Providers再表示で匿名ONと他スイッチ（新規登録ON/手動リンクOFF/Confirm email ON）不変を確認。
- 設定控え・完了記録・画像はdocs/release_20261019/anonymous-auth.*とanonymous-*.jpg。
  CAPTCHA/OTP/SMTP/通常ログイン制限は未変更。実匿名登録テストは未実施。
  無効化は新規の匿名ログインを止めるもので、既存セッションの失効/アカウント削除とは別。
- 次のRender設定/デプロイ/公開は未実行で個別承認が必要。共有FREE_QUESTION_LIMITは保持する。
