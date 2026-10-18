# 公開後の開発依存更新（追跡用・未実施）

2026-10-18のRouter v7更新後のnpm audit結果は、backend 0件、frontend 9パッケージ（high 6 / moderate 3）。ユーザー判断により、下記9件の移行を公開後の作業として追跡する。公開に際して別途必要な本番ブランチ全件テスト・実認証/生成等の確認を省略するものではない。

| 残存パッケージ | 重要度 | 更新作業 |
| --- | --- | --- |
| braces, chokidar, micromatch, fast-glob, tailwindcss | high（5パッケージ） | Tailwind 4への移行、glob/監視依存の解消確認 |
| vite | high | Viteの承認済み新メジャーへの移行、plugin・Node・ビルド設定確認 |
| esbuild | moderate | Vite移行と合わせて修正版へ更新 |
| postcss-selector-parser, postcss-nested | moderate（2パッケージ） | Tailwind/PostCSS移行と合わせて修正確認 |

React Router / react-router-dom / @remix-run/router / wsの以前の指摘は今回の更新後監査では残っていない。件数は依存先への波及を含み、9種類の独立した欠陥という意味ではない。

## 公開後対応とする理由と残存リスク

FATE LABの本番フロントはViteが生成したdistの静的配信で、ここに挙げたNode製開発サーバー・CSS/glob処理ツールは利用者向け実行サーバーとして稼働しない。開発依存を本番で起動する構成に変えないことが前提。
一方「危険がない」「全ての依存コードが利用者へ一切届かない」とは断定しない。開発サーバーのファイル漏えい・Windows固有攻撃面、悪意あるCSS/glob/PRによるビルド停止等は開発者・CIに残る。公開後への延期はこの残存リスクを受け入れる運用判断であり、修正済みという意味ではない。攻撃経路と各advisoryは `dependency-audit-20261018.md` のRouter以外の残件表を参照。

## 当面の運用

- Vite/esbuildの開発サーバーをインターネットへ公開しない。localhost限定でも不審なサイトからの要求のリスクを完全には消せない。
- 本番は生成済み静的ファイルを配信し、npm run dev/previewを本番サービスの起動に使わない。
- 外部PR・不明なCSS/glob設定は秘密が注入されたCIで無審査実行しない。
- 新規の実行時依存の脆弱性や現在の前提が変わる指摘は、その都度公開可否を再評価する。

## 完了条件

1. 別途承認後にVite・Tailwindの移行を行う（今回は更新しない）。
2. npm auditを再取得し、上記パッケージの指摘解消と新規指摘を確認する。
3. frontend/backendビルド、mock-e2e6本、REMOTE決済フラグ両モード、returnTo安全テスト、見た目の差分を確認する。
4. 本番への反映は別途承認を得る。秘密キー・iOSを無断で変更しない。

担当・実施日は公開後に別途決める。この文書による自動実行・課金・外部チケット登録はない。
