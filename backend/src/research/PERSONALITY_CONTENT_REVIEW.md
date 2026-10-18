# v0.6.1 内容レビューの反映（P0）

`personalityContentReview.ts` は、原辞書を保存したまま内容の扱いを記録する研究専用レイヤー。改訂された性格辞書や、本番向けの文章生成器ではない。

- 版は `v061-p0-quarantine-v1`。元の `dictVersion` と各 `stableKey` を保持する。
- 622文言部品を識別する。関連する問題ID・保留理由・対象領域・原文を保持する。
- 部品単位で暫定的に384部品を `withheld`、238部品を `unreviewed` とした。保留部品に含まれる全単語が誤りという判定ではない。
- `school`、`verifiedSources`、`allowedMeaning` は未確定。レビュー中の出典IDを、そのまま確認済みの一次資料として登録していない。
- `publishableText` は全件null、`productionEligible` はfalse。未確認部品を自動承認しない。
- 原文は監査資料としてのみ保持。保留した主張を「かもしれない」「外では／内では」等に言い換えて残すことはしない。
- 新しい性格タイトルは作らず、日柱・中心星・章名の構造ラベルを表示する。
- 生剋・陰陽・中気・余気などの計算情報は保持。新しい解釈や加点を追加しない。
- 節入り経過日数の説明を暦日と区別した。境界値・丸め方式・タイムゾーンは未変更。

各章の依存条件を追跡するが、断片を集め直して承認済み文章を作らない。K003の対立した期限の助言、K008の同文重複も、元の意味が承認されていないため、単なる語尾修正・一文削除ではなく関連助言を保留する。

実行：backendで

```sh
node --import tsx --test src/research/lifeAxis.test.ts src/research/personalityContentReview.test.ts
node --import tsx src/scripts/research/personalityContentReviewAudit.ts <出力先> <既存comparison.json>
```

出力は原文と版を保持した `CLAIM_DISPOSITIONS.json`、全4,800章の条件・文言参照を保持した `CANDIDATE_DISPOSITIONS_4800.jsonl`、集計、閲覧用HTML。過去のFB・元比較ファイルは読み取りのみ。

既存の `lifeAxis.ts` / `lifeAxisPreview.ts` は旧版再現用としてそのまま残している。元レンダラーの出力を修正済みと誤認しないこと。本番・iOS・時系列・相性・対話に今回のモジュールを接続していない。
