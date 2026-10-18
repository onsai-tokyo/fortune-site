# 出来事コホートからの追加候補

研究専用。`cohortPatternCandidates.ts` は計算済みの配置と観測ラベルを結び、単独配置・同日重複ペアを列挙する。出来事の文章は天体・命式の計算に入れない。生成物は `productionEligible / trainingEligible / qualityEligible = false`。

## 再現

1. 元CSVをリポジトリ外に保持し、行番号・元入力・出典URL・公表日・除外理由を持つ `normalized.json` を作る。今回の変換は exports/celebrity-pattern-20260908/prepare.py に保存。
2. backendで `node --import tsx src/scripts/research/cohortPatternCandidates.ts PRIVATE_NORMALIZED_JSON NEW_OUTPUT_DIRECTORY` を実行。誕生情報と実際の発生期間のみを `buildEventPatternStudy` に渡す。
3. 今回の exports 内 `finalize.ts` で算命学の天中殺を追加し、候補を再集計。A–Dの既存計算にも条件を適用する。A–Dの観測文は候補条件の抽出に利用しない。

## 条件

- 日付精度を維持する。日付ありは当日、月のみは月内、年のみは年内をJST正午でサンプリング。年のどこかで成立する配置を「発生日に重なった」としない。
- 公表日を発生日へ変換しない。出生情報の矛盾、発生年未確認、二次資料のみ、未対応の歴史年代などは元行を残して保留。
- 計算機は既存設定を使用。西洋の許容角度、近似Lahiri、紫微斗数設定、四柱推命の暦計算を変更しない。国内出生地は県庁代表座標。海外出生の現地時間は未対応。
- 算命学は日干支からの天中殺と実期間の年支・月支。四柱推命と同じ干支由来の群として扱い、二つの独立票にしない。
- 宿曜・納音・九星の出生分類は `cohortBirthContext` に保存する。イベント時期の推定条件としては数えない。
- 時刻不明、または既存の±5分診断でASCが変わる場合、既存エンジンが保留した要素を復活させない。入力時刻そのものの信頼性は別途確認が必要。

## 候補の意味

`allOf` は氏名・生年月日・出来事年を含まない共通条件。`matchCandidate` は配置だけから同日成立日を返す。二つの文言が同一の元配置を指す場合はペアにしない。

`categories` はCSVの出来事分類ごとの行数、人物数、申告した家族単位数、年月日精度別人数。`supports` から元行へ戻れる。結婚・再婚と離婚・破局が両方ある条件は `hasOpposingRelationshipOutcomes` を立て、反対の出来事を隠さない。

単独配置は全件保持。ペアは同じ出来事分類で2人以上かつ2家族単位以上に出たものを表示する。これは探索結果の表示条件であり、本番スコアの閾値ではない。家族の照合は一部のみで、別群・別家族でも統計的独立は保証しない。

観測窓だけの標本なので非発生期間の分母、未掲載の出来事、人物を分けた検証がない。出現件数は的中率や「起きやすさ」の確率ではない。まず既知の事実との対応を見るための候補入力であり、結末の予測規則への昇格は別工程。

## 検証

`node --import tsx --test src/research/cohortPatternCandidates.test.ts src/research/eventPatternStudy.test.ts src/research/multiSystemStudy.test.ts src/research/vimshottariDiagnostic.test.ts src/lib/report/timingProductionIsolation.test.ts`

`node node_modules/typescript/bin/tsc --noEmit`

本番API・iOS・Web・認証・決済・DB・goldenを変更しない。
