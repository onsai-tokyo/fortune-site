# 認証メール文面（本番適用済み・配送確認前）

2026-10-19 公開作業の状況：それぞれ個別承認のもと、本番のMagic LinkとChange Email Addressの件名・本文を適用済み。
Dashboardの保存成功とプレビュー（日本語・8桁・1時間・リンクなし）を確認。
実メール配送とSecure email changeの旧・新両アドレスでの動作は未試験。
変更前文面と完了記録は `docs/release_20261019/auth-magic-link.before.json`・
`auth-magic-link.result.json`、`auth-change-email.before.json`・`auth-change-email.result.json`。

対象はWebの引き継ぎ向けSupabase **Magic Link** と **Change Email Address** のみ。Confirm signup、Reset Password、Invite user等、既存アプリ版で使う他テンプレートは変更対象外。本文はリンクを押させず、8桁コード `{{ .Token }}` を画面へ入力する方式とする。

## 適用前の確認

- 初稿は文面案のみだったが、2026-10-19に上記2テンプレートだけ個別承認を受けて設定済み。SMTP・OTP桁数/有効期限・Confirm signupは変更せず、実メール送信も未実行。
- 2026-10-18に本番Dashboardで **Email OTP length=8、expiration=3600秒、custom SMTP有効** を読み取り確認した。いずれも変更しない。Confirm signupを含む既存iOSの確認メールにも影響するため、Webの都合で桁数・期限を変更しない。SMTP有効は実配送成功を保証しない。
- Webの桁数は `VITE_EMAIL_OTP_LENGTH`（未設定なら8、6〜10の整数）でビルド時に指定する。stagingは6桁なので将来再開時に `6` で再ビルドする（今回は環境変数もデプロイも変更しない）。stagingは600秒設定のため、下の本番向け「8桁・1時間」本文をそのまま適用しない。Web画面は設定桁数と「メールに記載された有効期限内」を案内する。
- 同一Supabaseプロジェクトのテンプレートはアプリ間で共有される。既存iOSがMagic Link/Change Email Addressを利用する場合、文面変更も影響するため、リンクを削除する前に利用状況・承認を確認する。既存アプリを変えない方針を優先し、必要なら別プロジェクト等を別途検討する（今回は作成しない）。
- Secure email changeは無断で無効化しない。旧アドレス確認も必要な設定では、実際の両メールのトークンと画面の確認手順が一致するか別途実配送テストを行う。
- custom SMTPの準備、送信元ドメインの認証、送信制限を確認する。コードや実メールアドレスを共有ログに残さない。

## Magic Link：別端末から引き継ぐ

件名：`【FATE LAB】引き継ぎ用の確認コード`

HTML本文案（ConfirmationURL等のリンク変数は使用しない）：

```html
<div lang="ja" style="font-family:sans-serif;line-height:1.8;color:#242424">
  <h1 style="font-size:20px">FATE LABの確認コード</h1>
  <p>別の端末から引き継ぐための確認コードをお送りします。</p>
  <p>FATE LABで開いている「別の端末から引き継ぐ」の画面に、次の8桁のコードを入力してください。</p>
  <p style="font-size:30px;letter-spacing:0.2em;font-weight:bold">{{ .Token }}</p>
  <p>有効期限は発行から1時間です。期限が切れた場合は、FATE LABの画面から新しいコードを送信してください。</p>
  <p>このコードを他の人に教えないでください。運営がコードを尋ねることはありません。</p>
  <p>心当たりがない場合は、コードを入力せず、このメールを破棄してください。</p>
  <p>FATE LAB</p>
</div>
```

## Change Email Address：引き継ぎ用メールの登録・変更

件名：`【FATE LAB】メールアドレス確認コード`

HTML本文案：

```html
<div lang="ja" style="font-family:sans-serif;line-height:1.8;color:#242424">
  <h1 style="font-size:20px">メールアドレスの確認</h1>
  <p>FATE LABで引き継ぎ用メールアドレスの登録・変更がリクエストされました。</p>
  <p>手続き中のFATE LABのメールアドレス確認画面に、次の8桁のコードを入力してください。</p>
  <p style="font-size:30px;letter-spacing:0.2em;font-weight:bold">{{ .Token }}</p>
  <p>有効期限は発行から1時間です。期限が切れた場合は、FATE LABの画面から新しいコードを送信してください。</p>
  <p>変更前・変更後の両方のメールアドレスで確認が必要になる場合があります。画面の案内に従ってください。</p>
  <p>このコードを他の人に教えないでください。運営がコードを尋ねることはありません。</p>
  <p>心当たりがない場合は、コードを入力せず、このメールを破棄してください。</p>
  <p>FATE LAB</p>
</div>
```

## 将来の受け入れ確認

プレビューだけでなく、登録・アドレス変更・別端末引き継ぎを実配送で確認する。件名と日本語表示、8桁展開、1時間の既存有効期限、誤コード拒否、再送、使い回し不可、既存iOSへの非影響を確認。失敗時は変更前テンプレートへ運用担当者が戻し、OTP桁数・有効期限・Confirm signupは変更しない。本番へ未検証の案を直接適用しない。
