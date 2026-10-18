# Web公開準備・承認4項目の対応報告（2026-10-18）

## 範囲

作業場所は `/private/tmp/fatelab-web-staging-20261018`、ブランチは `codex/fatelab-web-staging-20261018`。
元ディレクトリの未コミット変更、iOSファイル、本番・staging環境、秘密キーには触れていない。push・デプロイ・課金・スケジュール登録・実データ削除は未実行。変更はローカル作業差分として保持している。

追記：後続のユーザー承認により、この報告を含むローカル変更を同ブランチへコミットする（pushなし）。公開方針は本番CAPTCHAを有効にせずサイトキー未設定で運用、匿名サインインの初期提案10回/IP/時間、開発依存9件はリスクを記録して公開後対応へ更新。最新の公開条件は `prelaunch-check.md` と `postlaunch-dependency-work.md` を優先する。本番取り込み後のbackend全件成功は必須。

## 1. 決済オフ

- REMOTE判定は従来どおりSupabaseの公開URL/公開キーが設定されているか。
- REMOTEの `VITE_PAYMENTS_ENABLED=false` または未設定は購入不可。trueだけが将来のcheckout導線を表示する。
- REMOTEではフラグ値に関係なくpurchaseアクションが模擬加算タイマーを起動しない。trueでも決済会社未接続の間は準備中エラーを表示し、購入後画面へ偽の完了遷移をしない。将来の決済会社checkout・Webhookでのサーバー付与に差し替える接続箇所は維持。
- falseでは `/credits` と `/credits/return` を「相談のブックは準備中です」に統一。0冊時の作成送信は無効だが、相談入力・保存・下書きへの復帰は可能。メニュー・ヘッダー・本棚・トップ料金・販売価格表示も新規購入の案内を準備中にする。
- 冊数がある場合の作成・既存ブックの質問には決済フラグを条件にしない。REMOTEの作成はサーバーへ送り、見本用の自動配達タイマーは使わない。
- 非REMOTEの見本データモードでは従来の「書く→買う→自動作成」を残す。REMOTEの `/demo` とapplyDemoは無効化し、見本冊数を実接続画面へ混ぜない。
- trueの支払い後自動作成ではサーバーへ実際に作成依頼を出す経路を維持。現在決済会社のcheckout自体は未実装であり、有効な決済連携ができたという意味ではない。

検証：paymentPolicyの4件、REMOTE false/trueのローカルブラウザfixture。全API・認証を合成応答に置換し、実Supabase/Render/Anthropicには接続しない。falseでは購入ボタン・戻りURL経由の仮付与がなく、相談が画面往復・再読込後に残る。サーバー応答で1冊付与された場合の作成と追加質問2回はfalse/true双方で成功。trueでも仮付与されずcheckout未接続の案内になる。

## 2. React Router v7とreturnTo

- react-router-dom / react-routerは **7.18.4**。Vite **5.4.21**・Tailwind **3.4.19**は据え置き。Reactのメジャー更新なし。
- `safeReturnTo` を追加し、Onboarding/Creating/Restoreの3導線で共用。外部scheme、protocol-relative URL、バックスラッシュ、制御文字、曖昧な多重エンコード等を拒否し、それぞれの内部既定ページへ戻す。有効な内部パス・クエリ・fragmentは維持。
- v7の遷移更新で、端末利用終了の状態リセットが先行してRequireProfileと競合した。Settingsの利用終了・退会の状態リセットとトップへの遷移を同じstartTransitionにまとめて修正。削除APIやiOSには変更なし。

検証：フロントビルド成功。safeReturnTo単体2件（複数攻撃パターン含む）、ローカル実画面で3導線の危険returnTo拒否と正常なquery付き復帰を確認。既存mock-e2e 6本はすべて最終実行完了、FAILなし、pageerrors出力は空、crawlerは158ルートでno issues（仕様どおりのcoupleリダイレクト4件を別集計）。

最終frontend監査：**9件（high 6 / moderate 3）**。Routerと@remix-run/routerの指摘はなくなった。残るVite/esbuildとTailwind/PostCSS系は、承認どおり今回はメジャー移行しない。実際の使用経路と影響は初回 `dependency-audit-20261018.md` の残件表（Router以外）を参照。backend監査は0件。

## 3. 15件の依存修正前再現

依存修正前コミット **6325648838cf21ee6cf0c67d13a23bac482e6999** を `git archive` で `/private/tmp/fatelab-before-audit-g5x4fl` に展開。
当時のbackend package-lockを用い `npm ci --ignore-scripts --no-audit --no-fund` で独立インストール後、`npm test` を実行した。

| 対象 | 結果 |
| --- | --- |
| 依存修正前・当時の依存 | 591件中576成功、15失敗 |
| 今回の修正後（清掃7件をnpm testへ追加） | 598件中583成功、15失敗 |

両ログの失敗名を重複除去・ソートして比較し、**15件完全一致**を確認。全てarchitecture.test.tsのiOSソース契約検査であり、依存更新で生じた失敗ではない。iOSファイルもarchitectureテストも変更していない。失敗一覧は初回報告の15行を参照。

生ログは一時ディレクトリの `fatelab-before-audit-tests-20261018.log` と `fatelab-final-tests-20261018.log` にあり、失敗時のSwift全文を含むためリポジトリへは取り込まない。全件成功とは扱わない。ユーザー方針に従い版の不一致を記録するだけとする。

## 4. 匿名アカウント清掃

- 引数なしと `--dry-run` は候補件数のみ。実行を明示する `--apply` でのみ削除可能。
- 全候補のbook/grant照会が成功するまで削除を始めない。error/null/不正件数は中断。apply中の再照会や削除失敗も以降を中断。
- emailがないことだけで匿名と判定せず、is_anonymous=trueを必須にした。
- 一覧全ページを削除前に収集し、apply直前に再確認する。削除しながらページを進める取りこぼしも除去。
- 注入済み環境変数をdotenvで上書きしない。ログは集計のみ。

メモリ上のfake storeによる7件のテスト成功。dry-run非削除、book/grant両照会の失敗・count不明、非匿名・最近利用・購入ありの保護、再確認・削除失敗、1000件超のページングを確認。実行スクリプト本体はdry-runも含め実環境では一度も実行していない。
定期実行は未設定。既存iOS購読等の追加保護基準や競合排除・最大件数・重複ロックは未完了なので、自動運用開始は引き続き推奨しない。運用案は `anonymous-cleanup-scheduling.md`。

## テスト集計と公開前の残り

- frontend/backendビルド成功。Supabaseのstatic/dynamic import混在の警告は残る。
- 新規単体テスト13件成功（決済4・returnTo2・清掃7）。清掃7件はbackend npm testにも含めた。
- backend全件は上記既存15件のみ失敗。テストをskip・削除・緩和していない。
- mock-e2e既存6本成功。REMOTE購入オフ/オンfixtureとreturnTo実画面テストも成功。これらは実APIのE2Eではない。
- stagingSmoke本体、Authメール設定、実メール配送、実CAPTCHA、実AI認証・生成、旧キー失効確認、本番SQL適用・リリースは未実施。前回の中止方針を継続。
- Vite/Tailwind移行は公開後に回す承認のため未実施。残存リスクと開発サーバーの公開禁止を共有し、本番静的配信と開発サーバーの攻撃面を混同しない。
- 実決済は会社決定後にcheckout/Webhookを接続し、REMOTEのクライアント付与禁止を保持して検証する。公開時は `VITE_PAYMENTS_ENABLED=false` を明示し、再ビルドする。
- 公開判断には既存iOS版とarchitecture契約の不一致の扱いを確認する必要がある。iOSを変更せず、失敗を記録済みとして扱う今回の範囲を超えて勝手に修正しない。
