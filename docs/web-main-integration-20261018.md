# mainとのローカル統合 続報（2026-10-18）

## 状態

本番変更・push・staging作業・実AI/メール送信は未実行。公開可能の判定ではない。
作業場所は `/private/tmp/fatelab-web-release-20261018`、ブランチは `codex/fatelab-web-release-20261018`。
main `79da2705966908e91bf49004fad89fbc9bca9837` に Web `88053d8` をローカル統合。元のdirty checkoutは変更していない。
初回の49競合は、mainの既存機能を正として解決し、Web固有部分だけを追加した。

## 統合方針と変更

- iOS、生成エンジン、Apple、既存partners/preview/timeline/books、ワーカー、architectureテストはmainから変更なし。`node backend/scripts/checkWebIsolation.mjs` で比較確認する。
- 共有readingの変更はレート制限middlewareのexportだけ。共有indexの変更は `/api/web` の追加だけ。
- Web APIを `/api/web/*` に分離。WebブックはWeb付与冊数だけを使い、iOSの会員・Apple購入・審査・無料体験の冊数を使わない。既存mainの相手・読みもの・年表処理へ必要な経路を接続する。
- Webのブック質問は既存と同じ質問レート制限および月間AI利用枠を使う。failed/staleは残回数に数えず、同じ生成中operationIdの再要求ではAIを再実行しない。
- 現mainの `ai_book_order` は非会員を拒否するため、最初のWeb SQLへサービスロール専用 `ai_book_order_web` を追加。既存関数を置換しない。同じユーザーロックを使い、所有権・同一操作・Web冊数消費を確認する。**このSQLは本番に適用していない。**
- 同一originからAPIを使えるよう、Vercel設定に一般 `/api/*` → 既存Render APIのproxyを追加。Apple通知の転送先は維持。未デプロイ。
- 決済falseのREMOTE fixtureで、仮購入による増冊が起きず、付与済みなら作成・質問できることを確認。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| main単体 backend npm test | 512件：501成功・11失敗 |
| 統合版 backend npm test | 522件：511成功・同じ11失敗 |
| Web追加テスト test:web | 10件成功 |
| main既存ブック test:books | 39件成功 |
| backend / frontend build | 両方成功 |
| frontend unit | 81件成功 |
| mock-e2e既存6本 | journey/guest/logic/bugs/probe3/crawl 全完走 |
| 追加画面テスト | legal_pages / email_otp / return_to / payments_remote 成功 |
| main保護ファイル比較 | 成功：iOS/エンジン/既存APIの保護対象変更なし |
| ローカルPostgreSQL Web冊数統合テスト | 14チェック成功 |
| 質問DBテスト | 全チェック成功：2回制限・同一操作・失敗不算入・10分経過・failed上書き防止・他人拒否 |
| 保存DBテスト | 全チェック成功：キー別保存・相手削除・退会cascade |

DBテストは使い捨てローカルPostgreSQLのみ。Web冊数テストはmainのブック関連マイグレーション列を適用し、Auth/Stripe/読みものの外部依存は最小fixtureで補う。全リポジトリ全SQL・本番完全複製の検証ではない。
Web SQLの2回適用、review/trial付帯条件維持、元iOS関数定義不変、既存会員作成、Web/Apple等冊数分離、並行同一操作の二重消費防止を確認した。過去SQLはこの新規ローカルDBだけで使用し、本番では使用しない。

## 既存11失敗の切り分け（テスト・iOSは未変更）

いずれも `backend/src/lib/architecture.test.ts` の静的ソース検査。main単体と統合版で同じ失敗であり、Web統合で新たに発生したものではない。ただし、これだけで機能上の問題がないとは断定しない。

| 対象 | 現mainとテスト期待の差 |
| --- | --- |
| StoreKitサーバー状態 | 古いAPI呼出し名・300文字内という正規表現。現実装はperformSync/injected api.statusとowner照合 |
| オンボーディング | 期待5段階、現6段階 |
| 相性生成の計測 | 旧AI停止理由/トークンログを期待。現リクエスト経路はbuildCompatibilityV24とlogReportGeneration |
| 相性のprompt cache | 旧AI直接呼出しを期待。現相性経路は決定論的生成。読みもの質問のcacheとは別 |
| 本人鑑定の選択 | 期待 !isCompatibility のみ、現 !isCompatibility && !isChat（追加除外） |
| 相性結果の導線 | inlineタブの文字列を期待。現InsightHubViewへ委譲 |
| 設定の購入復元 | 旧Button文字列/Divider引数を期待。現SettingsUtilityRowとSettingsDivider既定値 |
| 小画面表示 | 1行+縮小を期待。現複数行中央寄せ/最小高さ。実UIの確認が必要 |
| Apple等認証ボタン | 期待whiteOutline/56、現white/44+親52等。実UI・承認済みデザイン確認が必要 |
| タブ | enum5種/旧アイコンを期待。現enum6種・表示5タブ・compose/本棚へ変更 |
| App Store復元導線 | 旧「もう一度確認する」Buttonの文字列を期待。現別コンポーネント。owner保護の動作検証は別途必要 |

推奨：iOSを過去UIへ戻さず、現mainの承認済み仕様を確認したうえで、同じ認可・所有権・復元の保証を失わない静的テストへ更新する。単なるskip/期待削除はしない。UI差分は実画面確認も必要。**この方針の承認前に11件を勝手に合格扱いにしない。**

## 公開前の未解決事項・判断

1. 上記11件の扱いと実UI確認。backend全件成功という公開条件は未達。
2. `FREE_QUESTION_LIMIT=0` はiOS非会員に影響するため変更しない。Web専用の読みもの質問経路は403としたが、**経路分離だけではWeb JWTから既存iOS経路への直接アクセスを防げない**。Originや自己申告ヘッダーを認可根拠にしない。厳密にWebだけ無料枠を止める必要があるなら、信頼できるアカウント来歴など別ポリシーの設計・承認が必要。
3. 旧 `/r/:token`・`/s/:id`・`/reading/:id` とSEOページはまだ新Webではトップ転送。互換性は未解消。旧購入画面を丸ごと戻すと決済falseに反するため、必要な閲覧機能だけを残す案が推奨。
4. 旧iOS向け公開法務文書の保存・リンクと、新Web文書の未確定［ ］・専門家確認が未了。既存ソースを保持しただけでは外部公開URLの契約差分は解消しない。
5. ASC/広告実設定はログイン未了で未確認。本番メール・匿名設定・本番API/ワーカー/iOSの通し確認はBで別途実施する。

以降もB1〜B8は各手順前に内容・戻し方を報告し、個別OKを待つ。B4は当初案をそのまま実行しない。B6はドメインを先に切り替えない方法を使う。詳しい旧ドメイン/戻し方/B計画はrelease-preparation-20261018.md参照。
