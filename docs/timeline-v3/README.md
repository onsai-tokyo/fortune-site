# 時系列鑑定 v3 一式

| ファイル | 読む人 | 内容 |
| --- | --- | --- |
| `CHANGES_v2.25.md`・`v2.25_remove_marriage_guarantee.patch` | 確認する人 | v2.24 からの変更（婚期の補完の削除）の内容・差分・検証結果 |
| `CODEX_HANDOFF.md` | Codex（最初に読む） | 作業一覧、会話で決まったことの全体、タグ一覧、変えてはいけないもの、確認コマンド |
| `LOGIC.md` | 全員 | 今の判定ロジックのまとめ（一人分・二人分、人生の時期＋占術） |
| `IMPLEMENTATION.md` | Codex・開発者 | 仕様、計算、判定、文章の組み立て、配線手順、完了条件 |
| `MANUSCRIPT_GUIDE.md` | 原稿担当・Claude | 鑑定文の部品の書き方と増やし方 |
| `EVENTS.md` | Codex・開発者 | 年表入力の読み解き（新機能）の仕様：API・DB・iOS・同意 |
| `COUPLE.md` | Codex・開発者 | ふたりの時系列 v3 の仕様：判定・文章・配線 |
| `VALIDATION.md` | オーナー・開発者 | これまでの検証結果と、ルールを変える前の検証手順 |
| `astrology.patch` | Codex | 既存 `astrology.ts` に `export` を3つ付ける差分 |
| `samples/*.txt` | 全員 | サンプル入力ごとの出力を読みやすくしたもの |

コード：`backend/src/lib/report/timelineV3/`（参照実装・原稿・テスト・期待出力）。

Codex への依頼文の例：

> まず `docs/timeline-v3/CODEX_HANDOFF.md` を読み、作業一覧（A〜D）の順に進めてください。最新の判定ロジックは `LOGIC.md` と参照コードが正です。`docs/timeline-v3/IMPLEMENTATION.md` の §8 配線手順に沿って時系列鑑定 v3 を組み込み、続けて `docs/timeline-v3/EVENTS.md` の年表入力の読み解きと、`docs/timeline-v3/COUPLE.md` のふたりの時系列 v3 を実装してください。ひとりの時系列には、プロフィールの「今の状況」（`relationshipStatus`）、年表（`lifeEvents`）、交際中なら登録中の相手の出会った年（`partnerSince`）を渡してください（保存済み鑑定書の再表示も同じ）。`timelineV3/` の判定ロジックと 原稿の JSON（`parts.json`・`depthParts.json`・`areaParts.json`・`personalParts.json`・`eventParts.json`・`pairParts.json`）は変更しないでください。v3 は現行の年間鑑定の計算部分（`annual3600/engine.ts`・`catalog.ts`・`inputPolicy.ts`）を使うので、年間鑑定を外すときもこの3つは残してください（原稿の `annual3600/data/*.json` は v3 では使いません）。完了条件のチェックリストをすべて満たしたら PR を作成してください。
>
> なお、既存の `backend/src/lib/architecture.test.ts` で10件のテストが失敗していますが、時系列 v3 とは無関係で、v3 を入れる前の元のソースでも同じ10件が失敗します（StoreKit の購入後の状態確認、UI の構成〈白黒テーマ・オンボーディング・認証画面・5タブ・小画面表示・設定画面〉、相性鑑定の生成経路・プロンプトのキャッシュ・個人情報の扱い）。いずれも iOS・画面のコードの書き方を文字列で確かめるテストで、コードの変更にテストが追従していないと思われます。1件ずつ、今のコードが意図どおりならテストを今の書き方に合わせて直し、意図と違う変更ならコードを直してください。特に課金（StoreKit）と相性鑑定の3件は、守るべき約束（購入後にサーバーの状態を正とする、相性の生成に個人情報を含めない、課金判定を同じ経路で通す）が今のコードで保たれているかを確認してから直してください。この対応は時系列 v3 とは別のコミットにしてください。
