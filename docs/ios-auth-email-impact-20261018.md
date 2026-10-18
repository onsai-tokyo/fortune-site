# iOSの認証メール利用確認（2026-10-18・読み取りのみ）

## 確認した版

1. GitHub APIで確認時点のmain HEADを取得し、**79da2705966908e91bf49004fad89fbc9bca9837** と特定。このコミットのGitオブジェクトを取得し、全iOS Swiftソースをgit grepで読み取り確認した。ブランチの移動・checkout・pushはしていない。
2. 手元の `/Users/yamazaki_manami/Documents/ChatGPT/fotune-lab/fortune-site-ios-work` にあるiOSソースも、未コミット変更・未追跡Swiftを含めrgで確認した。この作業ディレクトリのHEADは44a528aだが、読み取った内容はdirtyな作業版なので、そのHEADと同一の版とは呼ばない。

iOSファイルはどちらも変更・取り込み・コミットしていない。既存アプリ用の公開設定や秘密キーは確認対象外。App Store/TestFlightに配布済みバイナリがどのソースに対応するかは今回検証していないので、全配布済みバージョンへの絶対的な非影響を保証するものではない。

## 結果

| Supabase機能 | 最新main / 手元作業版 | メール文面変更の判断 |
| --- | --- | --- |
| Magic Link / signInWithOTP（大文字小文字違い含む） | 呼び出しなし | 確認したアプリコードからの直接利用は見つからず。今回のWeb向けMagic Link本文変更がこの経路を変える根拠は見つからない |
| メールアドレス変更 / update(user: UserAttributes(email: ...)) | 呼び出しなし | 確認したアプリコードにChange Email Addressの送信開始経路なし |
| resetPasswordForEmail等のパスワード再設定・recoverエンドポイント | 呼び出しなし | Reset Passwordはそもそも変更対象外として維持する |
| メール＋パスワード登録 / signUpと確認メール再送 | 利用あり | **Confirm signupの本文・リンク・OTP共通有効期限は変更しない** |
| メール＋パスワードログイン | 利用あり | Magic Link方式ではない |
| Google OAuth / Apple ID token | 利用あり | 今回のメールテンプレート2種類とは別経路 |

`auth.update(user: UserAttributes(...))` は見つかったが、いずれもApple認証後の `data: ["full_name": ...]` の更新だけで、メール変更ではなかった。

## ソース根拠

最新mainの `ios/FateLab/AuthStore.swift`：

- 147〜152行：メール＋パスワードのsignIn。
- 158〜166行：メール＋パスワードのsignUp。
- 178行以降：Google OAuth。
- 259行：Apple ID tokenでのsignInWithIdToken。
- 272行：full_nameメタデータのみのupdate。
- 357〜362行：resendConfirmationからtype=.signupの確認メールを再送。

[確認したGitHubソース（コミット固定）](https://github.com/onsai-tokyo/fortune-site/blob/79da2705966908e91bf49004fad89fbc9bca9837/ios/FateLab/AuthStore.swift)

手元作業版の対応箇所：AuthStore.swiftの140/151行にメールsignIn/signUp、263行にfull_name更新、342〜347行にsignup確認メールの再送がある。AuthView.swiftもメール登録・パスワードログイン・確認メール再送・Google/Appleの導線であり、設定画面のメールは表示のみだった。

検索はiOS配下の全Swiftを対象に、signInWithOTP・resetPasswordForEmail/resetPassword・UserAttributes・auth.update・updateUser・otp/recoverの生エンドポイント・email_change/magiclink等を確認。単にAuthViewの見た目だけで未使用とは判定していない。

## 期限と今回の変更

SupabaseのEmail OTP Expirationは、OTPだけでなく登録確認・パスワード回復・メール変更等のリンクにも適用される。[公式説明](https://supabase.com/docs/guides/auth/auth-email-passwordless)

- 本番の現在値は1時間（3600秒）という運用前提を維持し、今回設定画面の確認・変更はしない。適用担当者は現行値を読み取り、想定と違う場合は変更せず相談する。
- WebのEmailCode案内とMagic Link/Change Email Addressの本文案を1時間に統一。6桁コードとリンクなしの方針は維持。
- Confirm signup、Reset Password、他の既存テンプレートは変更しない。
- stagingは過去に600秒へ変更済みだが、作業中止中のため今回は触らない。1時間文面のWebを10分設定の環境へそのまま適用しない。
- 共有プロジェクトの文面変更そのものは今回実行しない。将来の承認済み担当者による実メール受入確認は別途必要。

## 今回の検証

frontendビルド成功、Turnstile単体4件成功（サイトキー未設定時に通信しないテストを含む）。EmailCodeとメール本文案から古い「10分以内」「発行から10分」の表示がなくなったことを検索で確認。iOSや実メール・本番認証の動作テストはしていない。
