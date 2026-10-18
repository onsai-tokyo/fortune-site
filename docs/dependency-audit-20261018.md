# 依存監査・ローカル検証報告（2026-10-18）

> この文書は初回監査時点の記録。後続の承認作業でReact Router v7、決済オフ制御、清掃dry-runを追加した。最新状態と依存修正前の再現結果は `web-readiness-followup-20261018.md` を参照。

## 作業範囲

作業ブランチ：`codex/fatelab-web-staging-20261018`、隔離先 `/private/tmp/fatelab-web-staging-20261018`。
元の作業ディレクトリの未コミット変更、iOSコード、本番・stagingの設定やデータには触れていない。秘密キーは扱っていない。push・デプロイは未実行（このブランチのpushはstagingの自動デプロイを誘発し得るので行わない）。

元ディレクトリを指していたnode_modulesリンクを外し、隔離先に独立した依存をインストールした。frontend/node_modulesは以前のコミットに絶対パスのsymlinkとして誤って追跡されていたため、そのリンク削除も差分に含む。依存本体は.gitignoreに従いコミットしない。元のリンク先の内容は変更していない。

## 1. 脆弱性修正

backend/frontend両方で `npm audit fix --ignore-scripts` を実行。`--force`、overrides、直接依存のメジャー更新は使用していない。ライフサイクルスクリプトは実行しない。
backendでaudit fixを再実行してもtsxが古いままesbuild指摘が残ったため、既存の `^4.19.1` 範囲内で `npm update tsx --ignore-scripts` を実行し解消した。package.jsonの範囲は変更せず、lockfileを更新。

| 対象 | 修正前 → 修正後 |
| --- | --- |
| backend express | 4.22.2 → 4.22.3 |
| backend proxy-addr | 2.0.7 → 2.0.8 |
| backend qs | 6.15.3 → 6.16.1 |
| backend body-parser | 1.20.6 → 1.20.8 |
| backend ip-address | 10.5.0 → 10.7.4 |
| backend tsx / esbuild | 4.21.0 / 0.27.3 → 4.23.15 / 0.28.2 |
| frontend ws | 8.19.0 → 8.22.0 |
| frontend react-router(-dom) | 6.30.3 → 6.30.6 |
| frontend @remix-run/router | 1.23.2 → 1.23.4 |

最終npm audit：**backend 0件。frontend 11パッケージ（high 6、moderate 5）**。指摘数は依存先への波及を含み、11種類の独立した欠陥という意味ではない。wsと@remix-run/router自体の指摘は解消したが、React Routerの別の未修正指摘が残る。

### 残件とFATE LABでの使われ方

| 残存グループ | 実際の経路・影響 | npmが提示する修正 / 推奨 |
| --- | --- | --- |
| react-router / react-router-dom（moderate 2パッケージ） | WebAppはBrowserRouter/HashRouterのクライアントSPA。SSR hydrationは使わないのでdeserializeErrorsのSSR経路は現構成では使用しない。一方、RestorePage・OnboardingPage・CreatingPageはURLのreturnToをnavigateへ渡し、先頭 `/` と `//` だけを検査する。バックスラッシュを排除しておらず、open redirectを無関係とは扱えない。 | react-router-dom 7.18.4へのメジャー更新。承認までは実施しない。優先して移行とreturnToの同一オリジン検証、外部URL・バックスラッシュの回帰テストを別作業で行う。 |
| vite / esbuild（high 1、moderate 1パッケージ） | vite 5.4.21 / esbuild 0.21.5は開発・ビルド時に利用。本番はVercelがdistを静的配信し、Vite/esbuildの開発サーバーは動かさないため同じサーバー攻撃面は本番配信にない。ローカル開発ではファイル読み取り等の指摘が残る。Windows固有の経路は今回のmacOS/Linuxには直接一致しないが、開発サーバーの問題全体を無害とはみなさない。 | npmはvite 8.3.4を提示。メジャー更新のため未実施。別途互換性検証し、承認までは開発サーバーを公開しない。loopbackだけでも不審サイト閲覧経由のリスクはゼロにならない。 |
| braces / chokidar / micromatch / fast-glob / tailwindcss（high 5パッケージ） | Tailwind 3.4.19のソース走査・ファイル監視の依存。ネストしたglob等でスタック枯渇DoS。利用者の質問本文をglobに渡す構成ではなく、ビルド時のリポジトリ・設定が主な入力。本番ブラウザでこのツール群は実行しない。悪意ある依存・PR・設定によるCI停止リスクは残る。 | npmはTailwind 4.3.3を提示。CSS設定・見た目への影響があるメジャー更新なので未実施。別途UI比較を含む移行を承認して行う。 |
| postcss-selector-parser / postcss-nested（moderate 2パッケージ） | Tailwind/PostCSSのビルド処理で使用。複雑なCSSセレクタの処理によるCPU枯渇。一般ユーザーがCSSを投稿して実行させる経路は見つからないが、外部CSSやPRをビルドするCIへの影響は残る。 | 同じくTailwind 4系への移行をnpmが提示。上記とまとめて検証。 |

根拠となる公式監査情報：

- [React Router open redirect](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)、[SSR hydration](https://github.com/advisories/GHSA-337j-9hxr-rhxg)
- [Vite map path traversal](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)、[Windows deny bypass](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)、[UNC path](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)、[esbuild開発サーバー](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)、[PostCSS selector CPU exhaustion](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)

backendの修正対象はExpressのクライアントIP判定（trust proxy=1）やクエリ・本文解析、express-rate-limitのIP処理に関わる。依存更新はWebに限らず共有API実行時にも影響し得るので、将来反映前にはiOS回帰確認が必要。今回はローカル依存のみ更新。

## 検証結果

| 実行 | 結果 |
| --- | --- |
| backend npm test | **591件中576成功・15失敗**（全てarchitecture.test.ts） |
| backend npm run build | 成功 |
| frontend npm run build | 成功（Supabaseのstatic/dynamic import混在警告のみ） |
| npm run test:books | 10/10成功 |
| node --test scripts/stagingSmokeConfig.test.mjs | 3/3成功、通信なし |
| node --check scripts/stagingSmoke.mjs | 構文確認成功。スクリプト本体は実行していない |
| Turnstileのローカル単体テスト | 4/4成功、実キー・実CAPTCHAなし |

mock-e2eはSupabaseの実設定がないローカルビルドをHTTPSポート4175で起動し、MOCK_E2E_BASE_URLを指定して全6本を実行。初回はjourney/guest/logic/bugs/probe3の全チェックOK、pageerrors出力があるものは空。crawlerは6プリセット全158ルートを走査し、既知の `/couple` → `/couple/p-misaki` 4件だけを報告した。
この4件はCouplePageの意図した遷移であるため、該当4プリセット・パス・遷移先の完全一致だけを別集計し、他の問題で終了コード1になるようcrawlerを改善。最終再実行は終了コード0、`no issues`、`expected couple redirects 4`。全6本のローカル画面検証が完了した（実APIのE2E成功を意味しない）。

### 全件テストを成功扱いにしない理由

以前の591件成功は元のdirty作業ディレクトリでの結果。この隔離WebブランチはiOS変更をコピーしていないため、iOSソースと新しいarchitectureテストの契約が不一致になっている。
architecture.test.tsはNode組み込みのfs/assert/test/path/urlだけを使ってソースを読むテストで、今回変更したExpress等を実行しない。今回iOS・architectureテストはHEADから差分なし。依存更新とは別のソース整合性問題として扱う。テストを削除・skip・緩和して通したり、元の未コミットiOSソースを取り込んだりしていない。

| テスト行 | 不一致の概要 |
| --- | --- |
| 25 | PurchaseManagerにdeliver(transaction)…api.statusという契約がない |
| 42 | RootViewの失敗時landingStateとownerガードが期待と不一致 |
| 48 | Onboarding完了からあなたタブへ遷移する期待コードがない |
| 73 | APIClientのtransport.bytesがない |
| 107 | 保存snapshot.operationID.uuidStringがない |
| 122 | FLProgressIndicator(current:step,total:6)がない |
| 138 | 相性APIのtransport.bytes(for:call)がない |
| 196 | APIClientの402→paymentRequired変換がない |
| 211 | 相性結果conversationIdの期待設定がない |
| 257 | 共通入力のmultilineTextAlignment(.center)がない |
| 283 | AccountStorageのonboarding.completedUserIDがない |
| 326 | Appleサインインボタンwhiteスタイルがない |
| 352 | 本質カードのreport.cards.filter契約がない |
| 384 | 5タブ/ReadingCardListの期待導線がない |
| 413 | 購入状況再試行の期待文言がない |

**判断待ち**：推奨は、本番と一致する承認済みiOSコミットを参照する回帰テスト構成を別途合意し、Webブランチのテスト対象とiOS契約の整合を直すこと。既存アプリを変えない方針を守り、どのiOS版を契約の正とするか指定されるまでiOS変更やテスト条件変更をしない。現状は「全件成功」「公開可能」と報告しない。

## 2. stagingSmoke更新

元ディレクトリにしかなかった `backend/scripts/stagingSmoke.mjs` をこのブランチへ追加し、固定a33f17cを削除。`--expected-commit <40桁SHA>` または `STAGING_EXPECTED_COMMIT` を必須化。引数優先、大小文字正規化、未指定・短縮SHA・未知引数・重複指定は通信前に失敗する。接続先は引き続きstaging固定で、本番用には転用しない。引数解析だけを独立モジュールのローカルテストで検証。本体は未実行。

## 3〜5. ドキュメント

- `docs/prelaunch-check.md`：公開前確認、SQL3つだけ、付与1冊→作成→配達→質問2回→照合→退会、各段階の成功・失敗復旧、環境変数、Vercel/Renderの戻し方。**支払いフラグ未実装を公開ブロッカーとして明記**。
- `docs/auth-email-templates.md`：Magic Link/Change Email Addressの日本語件名・コード本文案、リンクなし。初稿の10分案は後続承認で1時間へ変更し、本番の既存有効期限は変更しない方針へ更新。既存アプリ用他テンプレートは対象外。共有テンプレート自体のiOS影響確認も必須。設定未実施。
- `docs/anonymous-cleanup-scheduling.md`：現在の清掃スクリプトはdry-runなし、照会失敗を0件扱い、emailなしの非匿名ユーザーを含む、ページング取りこぼし等があるため定期実行を推奨しない。安全性修正後の手動dry-runを最優先とし、将来の週次CI案を提示。課金・設定・削除は未実施。

## 判断が必要な点（いずれも未実装）

1. React Router / Vite / Tailwindのメジャー更新：Routerの認証後returnTo安全性を優先し、別途承認後に移行を推奨。
2. iOSソースとarchitecture契約の整合：承認済みiOS基準版の指定が必要。
3. VITE_PAYMENTS_ENABLEDの実制御とREMOTEの模擬購入停止：公開前の必須別作業として実装・テストを推奨。
4. 清掃スクリプトの安全性修正：現行のまま定期実行しない。別途承認を受けてdry-run/fail-closedから実装を推奨。

これらの判断が必要な箇所は手を止め、追加のメジャー更新・本番反映等をしていない。
