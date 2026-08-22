import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const workspaceRoot = resolve(backendRoot, '..')
const read = (path: string) => readFileSync(resolve(workspaceRoot, path), 'utf8')

test('フロントエンドに占術計算の重複コピーを戻さない', () => {
  for (const name of ['shichu', 'sanmei', 'nayin', 'kyusei', 'numerology', 'sukuyo']) {
    assert.equal(existsSync(resolve(workspaceRoot, `frontend/src/lib/${name}.ts`)), false, `${name}.ts が再追加されています`)
  }
})

test('プレミアム判定はhasPremiumAccessだけを使用する', () => {
  const auth = read('backend/src/middleware/auth.ts')
  const points = read('backend/src/middleware/points.ts')
  assert.doesNotMatch(auth, /requireSubscription|from\(['"]subscriptions['"]\)/)
  assert.doesNotMatch(points, /checkPremium|from\(['"]subscriptions['"]\)/)
  assert.match(points, /hasPremiumAccess/)
})

test('本人の鑑定操作はservice role clientを使用しない', () => {
  const reading = read('backend/src/routes/reading.ts')
  const adminUsages = [...reading.matchAll(/getSupabaseAdmin\(\)/g)]
  assert.equal(adminUsages.length, 2, '共有ページ取得とアカウント削除以外にadmin clientが使われています')
  assert.match(reading, /getSupabaseUser\(req\.accessToken!\)/)
})

test('旧AI鑑定プロンプトをpreviewへ戻さない', () => {
  const preview = read('backend/src/routes/preview.ts')
  assert.doesNotMatch(preview, /Legacy AI report generator|const hasPartner|const timeLine/)
})

test('PR12の鑑定APIは認証トークンを送り、チャット本文と次質問を分離する', () => {
  const api = read('ios/FateLab/APIClient.swift')
  const reading = read('backend/src/routes/reading.ts')
  assert.match(api, /calc\/divination[^\n]+token: token/)
  assert.match(api, /preview\/generate\?format=sse[^\n]+token: token/)
  assert.match(api, /URLSession\.shared\.bytes/)
  assert.match(api, /request\.timeoutInterval = 40/)
  assert.match(api, /case timeout/)
  assert.match(api, /advanced\(by: \.seconds\(45\)\)/)
  assert.doesNotMatch(api, /throw URLError\(\.timedOut\)/)
  assert.doesNotMatch(api, /\.timedOut, \.cannotFindHost/)
  assert.match(reading, /---NEXT---/)
  assert.match(reading, /suggestions/)
  assert.doesNotMatch(reading, /回答本文は必ず「結論」「読み解き」「気をつけたいこと」/)
  assert.doesNotMatch(reading, /各行「次の質問：」で示してください/)
})

test('PR14でキャンセル表示・チャット再生成・旧入力UIを戻さない', () => {
  const theme = read('ios/FateLab/Theme.swift')
  const root = read('ios/FateLab/RootView.swift')
  const chat = read('ios/FateLab/ReadingChatView.swift')
  const home = read('ios/FateLab/HomeView.swift')
  assert.match(theme, /error is CancellationError/)
  assert.match(theme, /urlError\.code == \.cancelled/)
  assert.match(root, /\.id\(conversationID\)/)
  assert.match(chat, /\.defaultScrollAnchor\(\.bottom\)/)
  assert.doesNotMatch(chat, /didInitialScroll|\.disabled\(input\.trimmingCharacters/)
  assert.match(home, /あなたを読む/)
  assert.match(home, /ReadingGenerationProgressView/)
  assert.doesNotMatch(home, /あなたのパターンを、\\nまだ読んでいません/)
  assert.doesNotMatch(home, /INSTANT ANALYSIS|\.background\(\.regularMaterial\)/)
})

test('鑑定書保存は出生情報の正規化キーで冪等になり内容由来のタイトルを持つ', () => {
  const api = read('ios/FateLab/APIClient.swift')
  const reading = read('backend/src/routes/reading.ts')
  assert.match(api, /options: \[\.sortedKeys\]/)
  assert.doesNotMatch(api, /String\(describing: report\.birthData\)/)
  assert.match(api, /readingTitle\(report\)/)
  assert.doesNotMatch(api, /"title": "命式鑑定書"/)
  assert.match(reading, /idempotency_key/)
  assert.match(reading, /\.limit\(1\)\.maybeSingle\(\)/)
})

test('認証エラーからアカウントの登録有無を推測できない', () => {
  const auth = read('ios/FateLab/AuthStore.swift')
  assert.doesNotMatch(auth, /このメールアドレスは登録済み/)
  assert.match(auth, /パスワード未設定の場合はGoogleまたはAppleでログインしてください/)
})

test('UI刷新は白黒テーマ・段階式オンボーディング・認証ゲートを維持する', () => {
  const theme = read('ios/FateLab/Theme.swift')
  const onboarding = read('ios/FateLab/OnboardingView.swift')
  const authView = read('ios/FateLab/AuthView.swift')
  const swiftUI = ['HomeView.swift', 'PartnerProfilesView.swift', 'ReadingChatView.swift', 'SettingsView.swift']
    .map(file => read(`ios/FateLab/${file}`)).join('\n')
  assert.match(theme, /static let canvas/)
  assert.match(theme, /struct FLPrimaryButtonStyle/)
  assert.match(onboarding, /FLProgressIndicator\(current: step, total: 5\)/)
  assert.match(onboarding, /birthTime == nil/)
  assert.doesNotMatch(onboarding, /わかる.*わからない/)
  assert.match(onboarding, /fatelab\.onboarding\.draft/)
  assert.match(authView, /signInWithGoogle/)
  assert.doesNotMatch(swiftUI, /design: \.serif|FateTheme\.(gold|ivory|paper)/)
})

test('相性鑑定は明示された自己鑑定IDを検証し、チャットは逐次SSEを返す', () => {
  const partners = read('backend/src/routes/partners.ts')
  const reading = read('backend/src/routes/reading.ts')
  const api = read('ios/FateLab/APIClient.swift')
  assert.match(partners, /conversationId/)
  assert.doesNotMatch(partners, /order\('created_at'.*limit\(1\)/)
  assert.match(partners, /SELF_READING_REQUIRED/)
  assert.match(reading, /parser\.push\(event\.delta\.text\)/)
  assert.match(reading, /res\.write\(`data:.*safeText/)
  assert.match(api, /URLSession\.shared\.bytes\(for: call\)/)
  assert.match(api, /AsyncThrowingStream<ChatEvent, Error>/)
})

test('相性生成は個人情報を含めず停止理由と出力量を計測する', () => {
  const partners = readFileSync(new URL('../routes/partners.ts', import.meta.url), 'utf8')
  assert.match(partners, /Compatibility generation metric/)
  assert.match(partners, /stopReason: message\.stop_reason/)
  assert.match(partners, /outputTokens: message\.usage\.output_tokens/)
  assert.match(partners, /attemptDurationMs/)
  assert.doesNotMatch(partners, /Compatibility generation metric[\s\S]{0,500}(birth_data|calculated_data|display_name)/)
})

test('出生時刻と相性会話の根本原因を判別できる計測を残す', () => {
  const preview = read('backend/src/routes/preview.ts')
  const reading = read('backend/src/routes/reading.ts')
  const partners = read('backend/src/routes/partners.ts')
  assert.match(preview, /Birth-time calculation metric/)
  assert.match(preview, /ziweiPalaceNames/)
  assert.match(preview, /kyuseiTimeStarAvailable/)
  assert.match(reading, /Reading conversation lookup miss/)
  assert.match(reading, /conversationId: req\.params\.id/)
  assert.match(partners, /Compatibility conversation persistence metric/)
  assert.match(partners, /conversationPersisted: true/)
})

test('相性鑑定は凪等な会話を1件保存し完了イベントでIDを返す', () => {
  const partners = read('backend/src/routes/partners.ts')
  const migration = read('supabase-reading-compatibility.sql')
  assert.match(migration, /kind text NOT NULL DEFAULT 'self'/)
  assert.match(migration, /partner_profile_id uuid REFERENCES partner_profiles/)
  assert.match(partners, /eq\('idempotency_key', compatibilityIdentity\)/)
  assert.match(partners, /kind: 'compatibility'/)
  assert.match(partners, /partner_profile_id: partner\.id/)
  assert.match(partners, /calculatedDataWithReport/)
  assert.match(partners, /type: 'complete', report, conversationId/)
})

test('相性鑑定はpartnersの一経路だけで生成し同じ課金判定を通る', () => {
  const partners = read('backend/src/routes/partners.ts')
  const analyze = read('backend/src/routes/analyze.ts')
  const api = read('ios/FateLab/APIClient.swift')
  assert.match(partners, /post\('\/:id\/compatibility', loadCompatibilityContext, requirePoints\(3\)/)
  assert.doesNotMatch(analyze, /post\('\/compatibility'/)
  assert.match(api, /\/api\/partners\/\\\(partnerID\.uuidString\)\/compatibility/)
  assert.doesNotMatch(api, /\/api\/analyze\/compatibility/)
  assert.match(api, /http\.statusCode == 402.*APIError\.paymentRequired/)
})

test('相性結果は選択画面と分離し本人鑑定と同じカード導線を使う', () => {
  const partners = read('ios/FateLab/PartnerProfilesView.swift')
  const insightHub = read('ios/FateLab/InsightHubView.swift')
  const api = read('ios/FateLab/APIClient.swift')
  const models = read('ios/FateLab/Models.swift')
  assert.match(partners, /navigationDestination\(isPresented: \$showCompatibilityResult\)/)
  assert.match(partners, /CompatibilityResultView/)
  assert.match(partners, /ReadingCardList\(cards: report\.cards, onQuestion: onQuestion\)/)
  assert.match(partners, /tabRouter\.openChat\(conversationID: conversationID, contextTitle: card\.title\)/)
  assert.doesNotMatch(partners, /ReadingCardList\(cards: report\.cards\) \{ _ in \}/)
  assert.match(models, /case conversationID = "conversationId"/)
  assert.match(api, /report\["conversationId"\] = object\["conversationId"\]/)
  assert.doesNotMatch(partners, /if let compatibilityReport \{[\s\S]{0,300}ForEach/)
  assert.match(insightHub, /struct ReadingCardList/)
  assert.match(insightHub, /InsightDetailView\(item: item\)/)
})

test('存在しない鑑定のチャットは404を再送せず一覧へ戻せる', () => {
  const chat = read('ios/FateLab/ReadingChatView.swift')
  assert.match(chat, /APIError\.http\(status: 404/)
  assert.match(chat, /conversationMissing = true/)
  assert.match(chat, /この鑑定を開き直してください/)
  assert.match(chat, /Button\("鑑定一覧へ"\)/)
  assert.match(chat, /else if !input\.trimmingCharacters/)
})

test('設定は4グループに整理し購入復元とログアウトを各カード内に保つ', () => {
  const settings = read('ios/FateLab/SettingsView.swift')
  for (const title of ['あなたのデータ', '鑑定と対話', 'メンバーシップ', 'アカウント']) {
    assert.match(settings, new RegExp(title))
  }
  assert.match(settings, /private var membershipCard/)
  assert.match(settings, /RoundedRectangle\(cornerRadius: 12\)/)
  assert.match(settings, /SettingsDivider\(edgeInset: 0\)/)
  assert.match(settings, /Button\("購入を復元"\)/)
  assert.match(settings, /SettingsActionRow\(title: "ログアウト"\)/)
  assert.doesNotMatch(settings, /Section\("購入"\)/)
  assert.match(settings, /padding\(\.bottom, 48\)/)
})

test('ログイン後の初期表示は端末フラグでなく最新の保存済み鑑定から決める', () => {
  const root = read('ios/FateLab/RootView.swift')
  const reading = read('backend/src/routes/reading.ts')
  assert.doesNotMatch(root, /fatelab\.onboarding\.completed/)
  assert.match(root, /APIClient\.shared\.status\(auth: auth\)/)
  assert.match(root, /status\.latestConversationID/)
  assert.match(root, /SavedReadingView\(conversationID: initialConversationID\)/)
  assert.match(reading, /latestConversationId/)
  assert.match(reading, /reading_conversations.*order\('updated_at'/s)
})

test('認証画面はメールを主役にしGoogleとAppleを同格で残す', () => {
  const authView = read('ios/FateLab/AuthView.swift')
  assert.match(authView, /メールアドレスでログイン/)
  assert.match(authView, /新規登録はこちら/)
  assert.match(authView, /registrationMethods/)
  assert.match(authView, /メールアドレスで登録/)
  assert.match(authView, /HStack\(spacing: 12\) \{[\s\S]{0,300}Button\("Google"\)[\s\S]{0,500}SignInWithAppleButton\(\.signIn\)/)
  assert.match(authView, /SignInWithAppleButton\(\.signIn\)/)
  assert.match(authView, /SignInWithAppleButton\(\.signUp\)/)
  assert.match(authView, /signInWithAppleButtonStyle\(\.whiteOutline\).*frame\(height: 56\)/)
  assert.match(authView, /auth\.errorMessage = nil; route = \.pending/)
  assert.match(authView, /パスワード未設定の場合はGoogleまたはAppleでログインしてください/)
})

test('本質カードは1列で相手と本人の出生情報入力を共通化する', () => {
  const hub = read('ios/FateLab/InsightHubView.swift')
  const home = read('ios/FateLab/HomeView.swift')
  const partners = read('ios/FateLab/PartnerProfilesView.swift')
  const theme = read('ios/FateLab/Theme.swift')
  assert.doesNotMatch(hub, /essenceColumns|LazyVGrid\(columns: essence/)
  assert.match(hub, /VStack\(spacing: 12\)[\s\S]{0,300}resolvedTab == "essence"/)
  assert.match(theme, /struct BirthProfileFields/)
  assert.match(home, /BirthProfileFields\(date: \$input\.date/)
  assert.match(partners, /BirthProfileFields\(date: \$date/)
  assert.match(partners, /DateComponents\(year: 1990, month: 1, day: 1\)/)
  assert.doesNotMatch(partners, /@State private var name = ""; @State private var date = Date\(\)/)
})
