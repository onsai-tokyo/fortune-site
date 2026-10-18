# 本番の匿名ログイン有効化前 RLS 確認（2026-10-18）

## 対象と方法

Supabaseの本番 `fortune-site` / main（`jarerymytxcsqvzduqub`）。Dashboard SQL Editorで `BEGIN READ ONLY` 内のSELECTだけを実行した。利用者レコード、auth.users、秘密キー、SMTPパスワードは読んでいない。DDL/DML、権限・認証設定変更、匿名アカウント作成はしていない。SQL Editor上の照会履歴は残る場合があるが、DBの定義・データは変更していない。

Supabaseの匿名ログインは `anon` ロールではなく `authenticated` を使い、JWTの `is_anonymous` で区別する。[公式説明](https://supabase.com/docs/guides/auth/auth-anonymous)。したがって `TO authenticated` に限らず `TO public` のポリシーも対象にした。再確認用SELECTは `queries/production-anonymous-rls-audit.sql`。

## 結論

全17ポリシー（publicの15テーブル）を確認。**認証ロールだけを条件に全行許可するポリシー、USING(true)、WITH CHECK(true)はなかった。** 全件に `auth.uid() = user_id` の所有者条件がある。匿名ユーザーは新しい本人UIDに属する行だけが対象となり、既存iOSユーザーの行へのアクセスがロール共有だけで増える定義は見つからなかった。

ただし **全件がPERMISSIVEで、is_anonymousによる除外は0件**。匿名でも以下の本人向け権限が付くことを許容するかは公開時の運用判断になる。Webの匿名利用に必要な本人データ操作は維持することを推奨。匿名スイッチをまだONにしてよい、または全機能が検証済み、という意味ではない。

## 全ポリシー

表の条件は `U = (auth.uid() = user_id)`。SELECTはUSING、INSERTはWITH CHECK、ALLは両方がU。UPDATEの明示WITH CHECKがNULLの場合はUSINGが新行の検査にも使われる。`public` は全ロールを指し、スキーマ名とは別。

| テーブル | ポリシー名 | TO | 操作・条件 |
| --- | --- | --- | --- |
| analyses | ユーザーは自分の履歴のみ操作可能 | public | ALL / U |
| life_events | life_event_owner | authenticated | ALL / U |
| logical_readings | reading_identity_owner | public | SELECT / U |
| profile_traits | Users manage own profile traits | public | ALL / U |
| reading_conversations | Users manage own reading conversations | public | ALL / U |
| reading_messages | Users manage own reading messages | public | ALL / U |
| reading_revisions | reading_revision_owner | public | SELECT / U |
| reading_save_operations | reading_operation_owner | public | SELECT / U |
| reading_shares | Users manage own reading shares | public | ALL / U |
| reading_usage | Users view own reading usage | public | SELECT / U |
| stripe_subscriptions | Users view own stripe subscription | public | SELECT / U |
| subscriptions | Users can insert own subscription | public | INSERT / U |
| subscriptions | Users can update own subscription | public | UPDATE / USING U、明示CHECKなし |
| subscriptions | Users can view own subscription | public | SELECT / U |
| timeline_profiles | timeline_profile_owner | authenticated | ALL / U |
| user_points | Users can view own points | public | SELECT / U |
| validation_consents | validation_consent_owner | authenticated | ALL / U |

## 実効権限との照合

- public/storageの通常・パーティションテーブルは照会時すべてRLS有効。`authenticated` はsuperuser=false、BYPASSRLS=false。
- `subscriptions` には本人INSERT/UPDATEポリシーが残っているが、**authenticatedのINSERT/UPDATE/DELETE権限はfalse、SELECTのみtrue**。ポリシーだけから「匿名で会員状態を書き換えられる」とは判断しない。テーブル権限がないのに列だけINSERT/UPDATE可能なケースもpublic全体で0件だった。
- `stripe_subscriptions` は本人SELECTのみで書込権限なし。`app_store_subscriptions` はSELECT権限自体はあるがポリシーがなく、クライアントの通常RLS経路は拒否される。`ai_books`、冊数・付与・無料体験関連台帳はauthenticatedのSELECT/INSERT/UPDATE/DELETE権限なし。匿名化だけで購入・会員・冊数の書換権限は生まれない。
- `reading_conversations` はALLポリシーでもテーブルSELECT権限がfalse。`reading_revisions` はSELECTポリシーでもテーブルSELECT権限がfalse。RLSはGRANTを代替しないため、表の「ALL/SELECT」をそのまま実行可能と読まない。
- バックアップテーブル等はテーブル権限があってもポリシーがなく、RLSにより通常クライアントは拒否される。storageにも照会時ポリシーは0件で、ロール共有だけのオブジェクト操作許可はない。公開バケット設定・署名URLはこのRLS確認とは別。

## RLS以外の補足と残るリスク

authenticatedから実行可能なpublicのSECURITY DEFINERは6件。うち4件は戻り値triggerの `enforce_partner_profile_limit` / `initialize_user_points` / `reading_conversation_snapshot_guard` / `release_deleted_question_operations` で、通常のRPCとして直接呼ぶ関数ではない。トリガーの全処理を今回の対象として再監査したわけではない。

通常RPC2件は本番の関数定義も読み取り確認した。

- `create_reading_chat`：owner=auth.uid()、NULL拒否、元のconversationもidとuser_id=ownerで照合。作成先・operationも本人UID。AI生成やクレジット付与を行う処理はこの関数内にはない。
- `save_reading_revision`：owner=auth.uid()、NULL拒否、partnerが指定された場合も本人所有を検証。本人のlogical reading/revision/operationを作成し、originはsaved_snapshot。クライアントが渡す本文を保存できるため、これはサーバー生成済み文章の真正性保証ではない。匿名からも本人の保存を可能にする仕様として扱う。

匿名ユーザーは本人の履歴・特性・メッセージ・同意・共有リンクなどを扱える。共有リンクを作るとその共有機能の範囲で本人の内容が外部公開され得るが、他人の行をRLSが許可するものではない。匿名の共有を禁止したい場合は別途仕様判断が必要で、今回は変更しない。保存容量や大量アカウント作成の乱用は所有者RLSだけでは防げない。10回/IP/時間の匿名作成制限と、既存APIのレート・AI利用上限・運用監視を併用する。

この結果は定義と権限の静的確認であり、本番の匿名アカウントでの読み書き試験は未実施。全APIの認可・全RPC・列データの信頼性・Storage公開設定まで安全と保証する監査ではない。本番反映で追加されるai_book_questions/reading_saves等は現時点の17件には含まれず、適用後に再照会する。公開直前に2UID間の取得/更新拒否と、自己保存・メール登録・引き継ぎの実配送確認を別途承認のうえ行う。メール登録時のmanual linking/Secure email changeの動作も設定を勝手に変えず実フローで確認する。

## 未変更の本番認証設定

custom SMTP=ON、匿名ログイン=OFF、manual linking=OFF、Secure email change=ON、Email OTP length=8、expiration=3600秒。メール2種は英語リンク式のまま。本文案は `auth-email-templates.md` に保存しただけで、設定・送信はしていない。Confirm signup・iOSコード・stagingにも変更なし。
