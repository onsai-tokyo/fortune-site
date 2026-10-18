# 開発者用研究CLI（合成staging）

実例台帳の形式と機構は実装されています。既存の特徴計算・学習・artifactはsynthetic_software_test限定です。別経路としてN05の実天体・太陽配置診断を追加しましたが、実占術モデルの学習、正式評価、production共通鑑定への接続は未実装です。Web route／一般ユーザーUIはありません。

## 実行環境

backendの既存Node依存（package-lock.json）と、solver用Pythonを使用します。Python依存はrequirements.txtの固定版を用意してください。CLIはソースから実行する契約です（tsc成果物へのPython同梱は未対応）。

`FATELAB_RESEARCH_DATA_DIR` はrepo外の絶対パス・owner専用0700。JSONは0600。`FATELAB_RESEARCH_PYTHON` は任意のPython実行ファイル。署名検証は `FATELAB_RESEARCH_OWNER_PUBLIC_KEY_FILE` の信頼済みEd25519公開鍵を使用します。秘密鍵はCLIへ渡さず、外部でcandidate checksumに署名します。テスト内の一時鍵はテスト専用です。

入力schemaはledger.tsのDataset/Subject/BirthRevision/Observation/CoverageRecord。観測、出生revision、source参照、許諾、discovery履歴、判定不能を分離します。原文はrepo外の参照先に保持してください。private_draftは台帳保存まで可能で、学習不可です。172節indexは全件needs_reviewであり、原子述語のcoverage完了ではありません。

## 操作順

backendを作業ディレクトリとし、`node --import tsx src/scripts/research/cli.ts` に次の引数を付けます。npmのresearch:*も同じCLIです。hashは直前の出力値を使用します。

1. `import --input /absolute/private/input.json --dry-run` で差分検証。
2. `import --input /absolute/private/input.json --commit` でimmutable revisionを保存。
3. `snapshot --dataset DATASET_ID` でsnapshotを確定。
4. `features --snapshot SNAPSHOT_HASH --canon synthetic-software-test`（合成のみ）。
5. `evaluate --features FEATURE_SNAPSHOT_HASH --plan /absolute/private/plan.json`。現状はevaluation.tsのsyntheticPlan()と完全一致する合成planのみ受理。
6. `propose --run RUN_HASH`。不足や改善なしはno_change。
7. ownerが候補を確認し、外部署名したapproval JSONを用意後、`approve --candidate CANDIDATE_HASH --approval-file /absolute/private/approval.json`。
8. `export --approved CANDIDATE_HASH`。任意の`--output`は新規ファイルのみ作成可能。
9. `activate --artifact CANDIDATE_HASH` はprivate staging pointerだけを変更。
10. `diff --old OLD_HASH --new NEW_HASH`。toyの4入力を比較。
11. `rollback --artifact OLD_HASH` は検証済み旧staging artifactへ戻す。

approvalの厳密な形式／署名対象はlib/researchStagingModel.tsとresearch.test.tsを参照。未署名・改ざん・未知operator・許可外項目・source lock不一致・撤回済みdatasetは拒否します。台帳revisionの変更は以前のsnapshotを失効させます。旧artifactでも失効したものにはrollbackできません。

## 検証と限界

`npm run test:research` は合成台帳・label独立性・group分割・Python学習・TS推論・署名・CLI全経路・撤回を試験します。Python依存が無い場合、学習はno_changeで、学習成功を要するE2Eは失敗します。通常のbackend試験はPythonを必要としません。

solverはL2 logistic regression、固定候補・validation選択・単回held-out test。toy値はソフトウェア試験用で、正式な占術閾値ではありません。観測数と独立subject/group数を区別し、unknownをnegativeにしません。CI出力はhash・集計・状態のみで、原文や出生値を通常ログに出しません。

このローカルCLIのアクセス境界はOS accountとprivateファイル権限です。同じOS accountを制御できる攻撃者への強固な隔離や管理Web認証を提供するものではありません。実データ利用前には正本feature adapter、承認済みEVAL-01、全原子述語のcoverage、D01/D02/D03の実装と別途の機能受入が必要です。

## coverage集計の読み方

`observationsWithoutCoverage`は対応付け自体がない観測数、`unreviewedCoverageRecords`はneeds_reviewのレコード数です。`unclassified`は対応付けなし、または対応付けにneeds_reviewが残る観測数です。訂正は同じIDの新revisionで行います。存在しないobservationIdへの対応付けはimport時に拒否します。

blocked_canon等への分類は実装済みを意味しません。またunclassified=0だけでは172節の全原子述語が網羅されたことを証明できません。原子述語の抽出と網羅性レビューは別途必要です。

`node --import tsx src/scripts/research/cli.ts coverage --dataset DATASET_ID` はprivate台帳と172節索引の読み取り専用監査です。対応キーはcoverageの`sourceDocumentId`を索引の`document`（時期／性格／相性等）、`sourceSection`を`sourceId`（T00等）へ明示的に合わせます。曖昧な別名の自動変換はしません。未対応節・未知参照・未レビュー数を返し、台帳やsnapshotは変更しません。全節を対応付けてもatomicReviewComplete／qualityEligibleはfalseのままです。


## N05 実出生の太陽配置・診断CLI

`node --import tsx src/scripts/research/cli.ts natal-diagnostic --snapshot SNAPSHOT_HASH` を追加。
repo外のprivate snapshotから実際のcalcAstrology→extractAstrologyFacts→太陽の牡羊座/天秤座booleanを生成し、
`natal-diagnostic-HASH.json`へ保存する。コンソールにはhash/件数だけを返す。
正確な年月日・時分、明示的Asia/Tokyo、1970〜2099に初期診断範囲を限定する。
地心太陽の星座だけなので出生地・県庁座標は使わず、角度/ハウス/時期/インド特徴は出さない。
未対応入力はnull/unsupportedで、正午や別timezoneへ補完しない。
対象subjectの参照を要求し、withdrawn/restrictedは計算を拒否。draftの計算は採用許諾ではない。
featureHashと計算source/lock hashを記録し、観測結果・名前は計算に渡さない。

これは実feature計算接続の診断のみ。独立ephemerisオラクル・正本/意味の受入は未完。
既存エンジンの実数経度と星座区間の照合はソフト検査であり独立天文検証ではない。
trainingEligible/productionEligible/qualityEligibleはfalse。toyのfeatures/evaluate経路を解除せず、
このファイルを正式評価・staging推論・共通鑑定へ読み込む機構はまだ接続していない。

## 年単位のダシャー説明の検証（2026-09-07）

`vimshottariDiagnostic.ts` の `diagnoseVimshottariInterval` は、既知の出生瞬間と
計算済みのサイデリアル月黄経から、指定期間に重なるマハー／アンタル期間を返す。
年の途中の切替を一つの年ラベルで隠さないための開発者用計算。
入力には明示的なUTCオフセットと計算元の参照が必要。未知の出生時刻は補完しない。
365.25日／年は検証用に宣言した方式で、採用済みの本番方式とは扱わない。
`qualityEligible / trainingEligible / productionEligible` はすべて false。
Web route・鑑定生成・本番scoreから呼び出さない。個別例のデータは引き続きGit外へ置く。

```sh
node --import tsx --test src/research/vimshottariDiagnostic.test.ts
```


## 多占術の複合文章・開発者用研究プレビュー（2026-09-08）

`multiSystemPatterns.ts` / `multiSystemStudy.ts` に20種類の複合文章候補と、
既存の多占術Evidenceからの研究用選択を追加。算命学は計算済みの天中殺・位相法の補足。
同じ干支や天文系を独立した複数票として扱わず、同テーマの対応と異なる領域の補完を分ける。

```sh
node --import tsx src/scripts/research/multiSystemStudy.ts /absolute/private/input.json /absolute/private/new-output-directory
node --import tsx --test src/research/multiSystemStudy.test.ts src/research/vimshottariDiagnostic.test.ts src/lib/report/timingProductionIsolation.test.ts
```

入力形式は `{cases: [{id, birth: TimingEvidenceBirthInput, observations: StudyObservation[]}]}`。
`StudyObservation`は`{id, year, months?, themes: TimingScoreKey[], note}`。
CLIの診断範囲は2013〜2026（18歳未満は除く）で、用途を広げる際は明示的な範囲設計が必要。
個人データの入力・出力はrepo外へ限定し、出力は新規0700ディレクトリ内の0600ファイル。
`study.json`に入力hash・計算source/lock hash・Evidenceと区間・本文・観測との比較、
`preview.html`に読める形の結果を保存する。原文や個別結果は通常のコンソールへ出さない。

観測ラベルは鑑定計算完了後に比較するだけで、本文選択の条件へ渡さない。
本実装は年内の対応候補であり、西洋の年代表点・流年・ダシャー区間の同時成立は未検証。
ダシャーの年途中切替を保持しても月の出来事を的中した証拠にはしない。
`qualityEligible/trainingEligible/productionEligible`はfalse。CLI/試験のみで使用し、
Web route、共有鑑定、本番スコアには接続しない。旧stagingの学習制限も解除しない。

### 単独占術の示唆も表示（2026-09-08、ユーザー指示による更新）

`multi-system-study-v2-single-supported` では、異なる根拠群が二つあることを
本文表示の前提にしない。available / matched / 正のsupport / 正のqualityが
成立するテーマを、18種類の本文で表示する。四柱推命・インド・西洋・紫微斗数の
どれか一つでもよい。算命学の計算済み天中殺・位相法は、別の文章として独立表示する。
複合20候補も必要テーマが揃えば一つの占術で表示し、根拠群数と一致の表示は保持する。
単一の事実が二つのテーマを支える場合も、独立した二票とは表示しない。
相反する根拠は単独テーマ本文に併記し、方向を断定する複合本文は抑止する。
事例照合の `supportedThemes` は単独の根拠を含み、`correspondence` は従来通り
複数根拠群の対応だけを表す。どちらも出来事の的中率ではない。
変更対象は研究表示条件であり、本番スコアの閾値やTiming V2の本番接続は変更しない。
