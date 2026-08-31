# Phase 3A / 3B 実装報告

## 実装範囲

- `timingClaim.ts`: 正本の型定義に `workStatus` と runtime context の型を追加
- `timingClaimAssets.ts`: 納品された199件を本文無変更で導入
- `timingClaimSelector.ts`: 本番未接続の純粋な選択エンジン
- `timingClaimSelector.test.ts`: Phase 3受入テスト
- 18スコア算出エンジン、新規Resolver、本番経路への接続は未実施

## 検証結果

- Phase 3受入テスト: 16/16 OK
- 納品物の既存回帰テスト: 11/11 OK
- 納品物の型・資産検査: OK（199件）
- backend TypeScript build: OK
- backend既定テスト: 375/375 OK（Phase 3の16件を既定対象へ追加後）
- self-reportゴールデンスナップショット: 12/12 OK
  - Phase 3とは別の `ageRange` 回帰を上流で修正後、完全一致を確認
- 2バッジ年の説明欠落: 0/300
- 20年鑑定書の `score_specific` / `compound` Claim ID重複: 0
- 同一 `semanticGroup` の5年以内再使用: 0

## claimFit 診断例

同じ `reset` 年に、`identity_reset=0.95` の候補と `career_change=0.661` の候補を比較した。

選定候補 `strong`:

```json
{
  "gateMargin": 0.852941,
  "coEventFit": null,
  "traitFit": null,
  "contextFit": null,
  "confidence": 0.8,
  "evidenceDiversity": 0.6,
  "salience": 0.8,
  "weightedSum": 0.475882,
  "appliedWeight": 0.6,
  "total": 0.793137
}
```

除外された上位候補 `marginal` は閾値を通過するが、`gateMargin=0.002941`、`weightedSum=0.220882`、`total=0.368137` のため下位になった。該当しない条件は `null` とし、その重みを分母から除外して再正規化する。ハッシュはこの比較に使われず、完全同点の候補間でのみ使われる。

## Phase 3受入テスト一覧

1. activeDomains 3件なら displayEvents 2件でも cp-14 を選べる
2. 領域が違う3件では rs-09 を出さない
3. reset+work+move+meeting では rs-09 が候補になる
4. 同一 semanticGroup の rs-09 と cp-14 を同じ年に出さない
5. 選択中に activeDomains を変更しない
6. 明確に成立した候補を閾値ぎりぎりの候補より優先し breakdown を返す
7. 付帯条件なしの明確な成立が、付帯条件つきの閾値ぎりぎり候補に逆転されない
8. fallback の素点が高くても score_specific を先に選ぶ
9. hash は完全同点だけに使う
10. 2バッジ年300件で説明欠落が0件
11. 20年で score_specific/compound の Claim ID重複が0
12. semanticGroup は5年以内に再利用しない
13. fallback は代替がなく8年以上空けば再利用できる
14. fallback は8年以上後でも代替候補があれば再利用しない
15. scores/traits/pending の安全側フォールバックと同一入力 deepEqual
16. claimFit 単体も診断可能

## fallback の順位付け

- `fallback` はスコア条件を持たないため、`gateMargin` は `null`。
- `score_specific` / `compound` と `fallback` は別プールで順位付けする。
- 非fallback候補を先に並べ、fallbackは不足枠だけを埋める。
- したがって、再正規化でfallbackの `claimFit.total` が高くなっても、score-specific候補より先には選ばれない。
- この優先順位を受入テスト8で固定した。

## Phase 3外で修正した ageRange 回帰

- 回帰導入: commit `0f06984` で `AnnualTiming.ageRange` が `age` に置き換わった。
- 回帰顕在化: commit `272a313` で表示側が `item.ageRange` を再参照したが、供給側は `age` のままだった。
- 修正: 計算層が `age` と `ageRange` の両方を必須供給するようにした。
- 型: `ReportInput.timing.annual` と `marriageCandidates` の `ageRange` を必須化した。
- 回帰テスト: 2027年について `age === 32`、`ageRange === '31〜32歳'` を検証する。
- ゴールデンスナップショットは不具合値で更新せず、上流修正後に既存値との完全一致を確認した。

## 未確定contextの扱い

- `WorkStatus` は値域を固定しない `string`。Resolver設計後に確定する。
- runtime context はキーを固定しない `Readonly<Record<string, string | number | boolean>>`。
- `has_external_deadline` / `has_presentation_audience` / `has_submission_target` を含め、具体キーはまだ定義していない。
- `external_output_commitment` は pending のまま、対象資産は `disabled_until_resolved`。

## 差分分類

- `contentDiff`: なし。6つの文章フィールドを含む資産ファイルは納品物とSHA-256一致。
- `metadataDiff`: あり。選択入力型、中央Policy、適合度内訳、除外理由、鑑定書横断状態を追加。
- `generatedOutputDiff`: なし。本番の `timingCards.ts` から新エンジンを参照していないため、現在のアプリ出力は変わらない。

## 次工程までの留保

中央Policyの数値は設計書どおり暫定値。18スコア算出エンジン完成後、実データ分布を測定して校正するまで本番へ接続しない。
