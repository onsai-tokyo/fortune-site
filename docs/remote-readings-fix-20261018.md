# REMOTE 読みものの見本混入修正（2026-10-18）

作業ブランチ: `codex/fatelab-web-release-20261018`。
本番/staging設定・SQL・push・iOSソースは変更していない。実ユーザー、メール配送、Anthropicにも接続していない。

## 修正と取得元

| 対象 | 取得元・変更 |
| --- | --- |
| 本人の読みもの | `GET /api/web/reading/conversations` の `kind=self/personal` を優先して選択。相性鑑定を本人と取り違えない |
| YouPage 見出し | `GET /api/web/reading/:id/cards` の本人の章の `title`。値がなければ「あなたの読みもの」 |
| 年ごとの流れ | `GET /api/web/reading/:id/timing-history` の `cards`。カードIDの実年、title/summary/tags、sections または pages の本文 |
| 性格の章 | `GET /api/web/reading/:id/cards` の本人用の章。timing/chart/locked を除外し、実ID/title/summary/sections/pages を利用 |
| ふたりの年表 | 新規 `GET /api/web/reading/:selfId/partners/:partnerId/couple-timeline`。本人と相手を所有者付きで検索し、既存iOSの `coupleSnapshot` / `snapshotTimeline` と同じ計算処理を利用。v3なら同じ `loadTimelineContext` も利用 |
| 出会った年 | 既存の Web マウント配下 `PATCH /api/web/reading/couple-timeline-settings/:partnerId?selfReadingId=...`。未設定なら入力フォームを表示 |
| 相談候補 | state の実 years / chapters / partner別coupleYears。URL、相談元カードID、テーマを実データから作成 |
| 保存一覧 | 実年表の年を使った `couple-<partnerId>-<year>`、実章ID、実本人年。見本年の補完を廃止 |

既存の iOS API のURL・返り値・ポイント処理は変更していない。
相性鑑定の既存作成APIは非会員のポイントを消費するため、自動呼び出しせずWeb専用の計算用APIを追加した。

### ブックの相談元

ふたりの年を明示的に相談に使うときだけ、新規APIの同じURLへ `POST {year}` を送る。
サーバーが所有する出生情報から再計算し、選択年と近隣の実年のカードを既存の
`saveReadingSnapshot` / `save_reading_revision` に保存する。クライアントの本文を正しい計算結果として採用しない。
本人・相手・年・リビジョン・計算内容から操作キーを生成し、同じ保存の再試行を識別する。
この処理では冊数・iOSポイントの消費やAI呼び出しをしない。新しいSQLも不要。

返された `sourceId` と `sourceCardId` を使い、Webブック作成へ `focusCardId` を送る。
Webブックのサーバー側でも既存の `resolveBookFocus` を使い、所有する読みものから焦点カードを解決する。
同じoperationIdで異なる焦点へ変更した場合は409。失敗後の再作成でも焦点IDを保持する。

### 読み込み・エラー・見本の分離

- REMOTEでは配列が空でも見本の年・章・本文を補わない。
- 読み込み中と、取得失敗＋再読み込みを明示。取得失敗時は過去の本文もクリアする。
- `［サンプル］` を含むAPI本文はエラーとして扱う。
- 見本本文を `demoData.ts` に隔離。REMOTEビルドではViteの解決処理で空データへ置換するため、見本本文自体を生成JSへ入れない。
- `/demo` は従来どおりREMOTEでは無効。見本モードの6本の画面テストは維持。
- 相手登録後に出会った年の保存だけ失敗した場合、登録済みの相手は残し、年表から再入力できる。登録自体を繰り返さない。

## 検証

- backend `npm test`: **526件成功、失敗・skip 0**。既存のarchitectureテストも含む。
- frontend unit: **90件成功、失敗・skip 0**（全 `src/lib/*.test.ts` と `src/web/data/*.test.ts`）。
- frontend `npm run build`: 成功。
- backend `npm run build`: 成功。
- 合成REMOTE別ビルド: 成功。生成JSに `［サンプル］` と既知の見本本文・見出しがないことを検査。
- 既存mock-e2e **journey / guest / logic / bugs / probe3 / crawl の6本成功**。FAIL・pageerrorなし、crawlは6状態でissuesなし。
- 新規 `docs/mock-e2e/remote_readings.py`: 本人2人の異なる生年月日×各2相手で成功。本人見出し/年/章、ふたり本文、相談候補URL/ID/テーマ、ブック送信の焦点、保存年、読み込み/失敗/再試行を検証。
- サーバーの実計算テストも本人2種類×相手2種類を検証し、legacy/v3の双方でiOSと同じ計算結果かつ4組が異なることを確認。
- 新規APIは別ユーザー・存在しない本人/相手・不正ID・選択できない年を拒否するテスト付き。実際のDBのRLS検査の代替ではない。

再実行方法は `docs/mock-e2e/README.md` を参照。

## 公開前に残る実環境での確認

- 本番DBの実データ形式・RLS・既存RPCの組み合わせ、実メールによる引き継ぎ。
- 実際の本番デプロイで、本人と相手を登録して年表を読む一往復。
- 管理者が付与した1冊での実AIブック生成と質問。今回のテストは外部通信を代替している。
- 新規Web APIを含むbackendとfrontendを組み合わせてデプロイする必要がある。画面だけ先に更新すると年表APIは取得失敗表示になる。
- 本番の設定変更や公開作業は、従来どおり各手順前の個別承認を待つ。
