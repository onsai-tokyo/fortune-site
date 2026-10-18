# FATE LAB Web版（画面実装）

キャンバスのデザイン（20画面）を、既存の Web 土台（React 18 + Vite + Tailwind + React Router）に実装したもの。
**データはすべて仮データ**で動いている。サーバーとの接続は次の段階。

## 動かし方

```bash
npm ci
npm run dev          # 開発サーバー
npm run build        # 本番ビルド（dist/）
```

- `/demo` に全画面・全状態への入口がある（本番公開前に外すこと）。
- 確認用に「#付きURL」で動かす場合：`VITE_ROUTER=hash npx vite build --base=./`

## 本番接続の環境変数

- `VITE_API_BASE_URL` — APIのベースURL（Vercel rewrite利用時は空でも可）
- `VITE_SUPABASE_URL` — Supabase URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_TURNSTILE_SITE_KEY` — 任意。設定時だけCAPTCHAを有効化
- `VITE_PAYMENTS_ENABLED` — 決済差し込み口。決済未実装時は `false`

Render側の `FREE_QUESTION_LIMIT` は `0` に設定します。`FRONTEND_URL` はカンマ区切りで既存ドメインと新Webドメインを併記してください。秘密鍵はフロントエンドに置きません。

## 構成

```
src/web/
  WebApp.tsx            ルーティング（URL一覧）とログイン・出生情報の案内
  components/
    ui.tsx              ボタン、カード、選択ボタン、入力欄、ヘッダー、フッターなど共通部品
    SiteHeader.tsx      共通ヘッダー＋メニュー（右上の三本線）
    icons.tsx           線のアイコン
  data/
    types.ts            データの型
    mock.ts             仮データ（文章はすべて［サンプル］）・料金（500円／5回1,980円）
    images.ts           自然の写真（public/images、iOS版から変換したWebP）
    api.ts              本番APIのパス一覧と fetch の土台（AI同意ヘッダー、操作IDなど）
  state/AppState.tsx    画面確認用の仮の状態（＝仮のバックエンド）
  pages/                各画面
```

デザインの値（色・文字・角丸）は `tailwind.config.js` の `fl-*` と `font-fl` / `font-book`。
iOS版 `Theme.swift` と同じ値。

> Codex への実装依頼（決済以外）は `CODEX_TASKS.md`。仮データ版の画面テストは `docs/mock-e2e/`。

## 仕様（2026-10-17 決定）

- **ログイン画面なし**。生年月日を保存した時点で、裏で匿名アカウントを作る（`supabase.auth.signInAnonymously`）。
- **最初から有料**。無料の1冊（DeviceCheck）はなし。相談のブックは 1回500円／5回セット1,980円。
- **相手は1人だけ**。登録し直すと入れ替わり、何度でも無料。前の相手について作ったブックは本棚に残す。
- **無料の質問はなし**。相談のブック1通ごとに、そのブックへの質問2回つき。
- **引き継ぎ**：決済時に領収書のメールを入力。そのメールに6桁のコードを送り、確認できたら匿名アカウントにメールをひも付ける（`updateUser({ email })` → `verifyOtp(type: 'email_change')`）。別の端末では `/restore` でコードを入れて開く（`signInWithOtp({ shouldCreateUser: false })` → `verifyOtp(type: 'email')`）。パスワードなし。
- **体験の流れ（2026-10-17 改善）**：トップで生年月日と性別だけ入れる → 「読みものをつくっています」→ 「あなた」で初回だけ案内 → 相談は残り0冊でも書ける →「500円で一冊つくる」→ 支払い → 反映されたら書いた相談で自動作成（`pendingCreate`）。
  - 本番では、決済の通知（Webhook）を受けたサーバー側で作成を始めるのが確実（画面を閉じても作られる）。決済開始時に下書き（読みもの・テーマ・相談文・operationId）を一緒に保存しておく。
  - 数え方は「冊」に統一（1冊 500円／5冊セット 1,980円／残り◯冊）。残り冊数は一度買うまでヘッダーに出さない。
- **ロボット対策**：匿名アカウントの作成・コード送信・決済の前に、見えない形の人間確認（Cloudflare Turnstile など。Supabase の CAPTCHA 設定）を入れる。

## URL と画面

| URL | 画面 | 本番で使うAPI（data/api.ts） |
|---|---|---|
| `/` | トップ | — |
| `/welcome` | 生年月日の入力（トップ以外から来た人・変更） |
| `/creating` | 読みものをつくっています（初回のみ） | SSEの進み具合 | signInAnonymously → calcDivination → selfGenerate |
| `/restore` | 別の端末から引き継ぐ（`/login` もここへ） | signInWithOtp → verifyOtp |
| `/you` | あなた | conversations, timeline |
| `/you/years/:year` | 読みものの本文 | timingHistory |
| `/you/chapters/:id` | 性格の章の本文 | calcDivination（章データ） |
| `/couple` | ふたり（相手がいないときの案内） | partners |
| `/couple/new` | 相手の登録・入れ替え（1人だけ） | 既存の相手を削除 → registerPartner |
| `/couple/:partnerId?year=` | ふたりの年表 | coupleTimeline, coupleTimelineSettings |
| `/compose` | 一冊つくる（残り0通の表示を含む） | bookStatus, bookValidate, bookCreate, bookOperation |
| `/books` | 本棚（作成中・失敗の表示を含む） | books, bookOperation |
| `/books/saved` | 保存した読みもの | conversations（保存済み） |
| `/books/:bookId` | ブックを読む | book |
| `/books/:bookId/ask` | ブックへの質問（1通につき2回） | askQuestion ＋ ブックごとの回数管理（要追加） |
| `/credits` | 利用枠を追加 | createCheckout（未実装） |
| `/credits/return` | お支払い後の確認 | bookStatus をポーリング |
| `/settings` | 設定・退会 | deleteAccount |
| `/settings/link` | 引き継ぎ用メールの登録 | updateUser → verifyOtp |
| `/settings/purchases` | 購入履歴 | 未実装 |
| `/tokushoho` | 特定商取引法に基づく表記 | — |
| `/terms` `/privacy` `/support` | 既存ページを流用 | — |

## 次にやること（本番接続）

1. **アカウント**：Supabase で匿名ログインと CAPTCHA を有効にし、メールテンプレートに6桁コード（`{{ .Token }}`）を入れる。`AppState.session` を実際のセッション（`is_anonymous`）に置き換える。
   - 匿名ユーザーにも今のRLS・RPCがそのまま効くかを確認する（`auth.uid()` は匿名でも入る）。
   - 放置された匿名アカウント（購入なし・一定期間アクセスなし）を定期的に削除する。
2. **読みもの・ふたり・ブック**：`AppState` の各操作を `data/api.ts` の関数呼び出しに置き換える。
   - 生成系は操作ID（`newOperationId()`）を localStorage に保存し、再読込後も `/operations/:id` で復帰する（既存 `src/lib/selfGenerationRecovery.ts` などを流用可）。
   - AI に送る操作（ブック作成・質問）は `aiConsent: true` で同意ヘッダーを付ける。
3. **決済**：決済会社が決まったら、バックエンドに checkout と Webhook を追加。
   - 利用枠は Webhook でのみ付与する（戻りURLでは付与しない）。
   - 5回セットは `ai_book_grant` に数量引数を足す改修が必要（現状 purchase は常に1）。
4. **サーバー側の変更**：
   - 無料体験（DeviceCheck・trial）を Web では使わない。
   - 相手の上限を常に1人にする（`partner_profile_capacity`）。入れ替え＝削除→登録。
   - ブックごとの質問回数（2回）を数える仕組みを追加。無料の質問（`FREE_QUESTION_LIMIT`）は0に。
5. **公開**：`vercel.json` は Web版向けに更新済み（SPA の書き換え、旧URLの転送）。
   - 旧構成を前提にした `web-closure.test.mjs` は `web-closure.test.legacy.mjs` に改名して外した。
   - リポジトリ直下の `vercel.json` も同じ内容にそろえること。
6. **利用規約・プライバシー・お問い合わせ**：文面は既存のまま。見た目をWeb版に合わせる作業が残っている。
7. `/demo` と「画面一覧（確認用）」リンクを本番では外す。

## 未決定（画面上は［ ］で表示）

- 決済会社名、代表者名、所在地、連絡先
- iPhoneアプリの利用者の引き継ぎ（現状は「引き継げません」と案内）
