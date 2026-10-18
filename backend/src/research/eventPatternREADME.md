# 期間別の出来事パターン研究

`eventPatternStudy.ts` の `buildEventPatternStudy(birth, {from, until})` は、出生条件と
半開区間の年月日だけから占術事実を計算し、`eventPatternRules.ts` で本文を選ぶ。
人物名・申告イベント・希望する文章は生成関数へ渡さない。

前の年代表値による `multiSystemStudy.ts` は履歴として保持する。
今回の実例調査で見つかった P01〜P08 を利用する入口は、この新しい期間別生成である。
本番 route / shared report / score engine へは接続しない。

## 実行

backend ディレクトリから実行する。

```sh
node --import tsx --test src/research/eventPatternStudy.test.ts src/research/multiSystemStudy.test.ts src/research/vimshottariDiagnostic.test.ts src/lib/report/timingProductionIsolation.test.ts
node --import tsx src/scripts/research/eventPatternStudy.ts /absolute/private/input.json /absolute/private/new-output
```

CLI入力は従来の `{cases: [{id, birth, observations: [{id, year, months?, note}]}]}`。
months は連続する月に限る。月未指定はその暦年全体。申告は期間の指定と計算後の表示だけに使用。
APIでは任意の正しい日付区間を指定できるが、1回366日以内・出生日後・出生から119年以内に限定。
入力と出力はリポジトリ外へ限定し、新しい出力ディレクトリだけを作る。既存プレビューは上書きしない。

## 追加した処理

- P01：実際の期間の日支への冲・破・六合、伝統的な関係領域の通変星を候補にする。
  四柱・算命学を同じ干支の根拠として扱い、重複票を作らない。三合・合化の成立判定は追加していない。
- P02：土星×金星ハードは関係の条件見直しとして出し、別れへ固定しない。
- P03：副期星の全12室の支配関係を計算。6室・10室は仕事、2室・11室は資源等の研究テーマへ対応。
  金星期を一律に恋愛へ写像しない。主要期は区間として保持するが、主要星の全解釈は未追加。
- P04：家庭の示唆を単独で表示し、別体系・別根拠群の同じ日次サンプルでの対応も記録。
- P05：紫微の流年命宮・四化を指定日で取得。夫妻化忌から離婚を、化科から交際成立を決めない。
- P06：干支、紫微、ダシャー、西洋を指定期間で判定。別の日にだけ出た要素を同時成立にしない。
- P07：接点と調整が同じ日次サンプルにあれば併記。天王星×金星の60/120度も接点の研究候補へ追加。
- P08：初回・同じ相手・別れの回数・法的婚姻・浮気・妊娠の事実属性は未判定として固定。

出力に確率や総合点はない。元の計算閾値・golden・本番機能は変更しない。
全出力の productionEligible / trainingEligible / qualityEligible は false。
systems数とgroups数は出典情報であり、その数に応じて的中確率を上げる処理ではない。

## 精度・制限

西洋は既存のアスペクト種類と許容幅を使うJST正午サンプル。
時刻不明では月・角度を除き、他の個人天体をJSTの24時刻で試した共通候補だけを表示する。
出生地・タイムゾーンが不明なら仮定を表示し、真の出生瞬間を確定したものとしない。
近似Lahiri、県庁座標、365.25日/年方式を維持。±5分は明示的な感度診断で、実際の申告誤差を意味しない。
この診断でASC星座が変わったら支配室による本文を保留する。時刻の修正や勝手な補完は行わない。
日次サンプルは厳密なトランジット時刻・節入り時刻・ダシャー切替時刻のイベント判定ではない。
宿曜・納音・九星の時期ルール、D9、紫微の流月・流日、未知人物への精度検証は未実施。
