# 鑑定質問・月額プラン 本番設定

コードを本番へ反映する前に、次の順で設定する。

## 1. Supabase

Supabase SQL Editorで `supabase-reading-stripe.sql` を実行する。

作成される主なデータは、鑑定履歴、質問と回答、無料質問の利用回数、Stripe契約状態、処理済みWebhookイベント。各ユーザー向けテーブルにはRLSを設定し、利用回数と契約状態はバックエンドのみ更新できる。

## 2. Stripe Test mode

1. 月額商品の商品とPriceを作る。
2. Price IDを `STRIPE_PRICE_ID` に設定する。
3. Customer Portalで、支払い方法の変更・契約確認・解約を有効にする。
4. Webhookの送信先を `https://fortune-site-iuzo.onrender.com/api/stripe/webhook` にする。
5. 次のイベントを購読する。

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

署名シークレットを `STRIPE_WEBHOOK_SECRET` に設定する。

## 3. Render

`render.yaml` に列挙した環境変数を設定する。秘密値はリポジトリへ保存しない。

- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`

`FRONTEND_URL=https://fate-lab.com` と `FREE_QUESTION_LIMIT=3` も確認する。

## 4. Test mode E2E

1. 無料鑑定を作成する。
2. 鑑定書内の「この結果について質問する」を開く。
3. 登録後も鑑定内容が引き継がれることを確認する。
4. 3問送ると残り回数が0になることを確認する。
5. 4問目で月額プランが表示されることを確認する。
6. StripeのテストカードでCheckoutを完了する。
7. 元の鑑定履歴へ戻り、質問を継続できることを確認する。
8. Customer Portalで解約し、Webhook後に契約状態へ反映されることを確認する。

本番Stripeへ切り替える際は、Test modeとは別のSecret key、Price ID、Webhook署名シークレットへ差し替える。
