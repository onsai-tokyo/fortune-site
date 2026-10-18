# 既存architectureテストのmain整合（2026-10-18）

ユーザーの続行指示を受け、mainでも失敗していた11件を現在のmain実装へ整合。iOS・本番・staging・共有APIの実装は変更していない。テスト削除・skipなし。

## 変更した保証

- StoreKit：旧API名と300文字距離の期待を、performSync内のserver status取得・配送後の再取得・owner照合・operation照合・server由来accessStateに置換。unknown時のSettings固有分岐ではなく、isPremiumがserver accessState由来、購入開始がstandardに限定されることを確認。
- オンボーディング：mainの6段階を期待。本人別の下書きキー・認証ゲートは維持。serif全面禁止は、現mainの購入価格だけ1箇所許容し、鑑定本文等へ広がらない検査に変更。
- 相性計測：旧AI停止理由/トークンの期待を、決定論的生成と件数/時間/生成元の計測へ変更。ログpayloadに個人情報や本文が混ざらない検査を維持。
- 相性cache：旧AI直接呼出し必須をやめ、現相性経路で決定論的生成、生成identity、AI直接呼出しなしを検査。読みもの質問のprompt cacheと圧縮contextは引き続き検査。
- 本人鑑定選択：相性だけでなくchatも除外する現mainの条件を期待。単一API経路/課金判定の検査は維持。
- 相性結果：共有InsightHubへのcouple scope委譲・scope別フィルター・命式/時期・カード閲覧・質問callback・conversationID必須を検査。閲覧grantのowner照合とアカウント変更時処理も検査。現mainはopenChatではなくopenBookへ送る。
- 設定：Buttonの文字列だけでなく、実restore呼出しと安定accessibilityIdentifierを検査。ログアウトやカード配置も維持。
- 小画面：旧1行縮小固定を、primary/secondaryの複数行中央寄せ・最小52ptに整合。閲覧余白と44pt操作領域の検査を維持。
- 認証：Appleの現whiteスタイル2箇所と両方のprepare/complete callbackを検査。旧outline/56pt/clip禁止のデザイン期待は置換。メール/Google/Appleの存在・名前連携・戻る導線は維持。
- タブ：enumには旧chatも残す6種、実際の表示はyou/couple/readings/compose/settingsの5種と検査。再選択resetと本棚への表示を維持。
- App Store同期：古いButton表記ではなく、sync/restoreの実呼出し・復元identifier・transaction所有者一致を検査。サーバー側ownership/移管/競合の既存検査は維持。

`checkWebIsolation.mjs` ではarchitectureテストのみ比較除外に変更。iOSや実行コードの保護対象を除外したわけではない。共有reading/indexの限定変更チェックも維持。

## 保証範囲

静的ソース契約テストが通ることは、ネイティブ実画面の見切れ・VoiceOver・Appleのデザイン審査適合・配布済みバイナリの動作確認を意味しない。これらは未検証として残す。mainのデザインをこの作業で変更・新たに承認したものではない。

検証結果：architecture単独33件成功、backend全件 **522件成功・失敗0・skip0**、backend build成功、main保護ファイル比較成功、iOS差分0件。
検証ログ：`/private/tmp/fatelab-architecture-updated-20261018.log`、全件再実行は `/private/tmp/fatelab-release-backend-aligned-20261018.log`。
公開前に残る旧URL互換性・法務未確定・無料枠の識別方針は `web-main-integration-20261018.md` を参照。Bの個別承認は引き続き必要。
