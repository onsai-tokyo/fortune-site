import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WEB_SUPPORT_EMAIL, webSupportQuestions } from './supportContent'
import { commerceRows } from './legalContent'

test('Web support matches the approved contact and Web-only product/account rules', () => {
  assert.equal(WEB_SUPPORT_EMAIL, commerceRows.find(row => row[0] === 'メールアドレス')![1])
  const text = JSON.stringify(webSupportQuestions)
  for (const expected of ['販売は準備中', '購入はできません', 'ひとつの相談に、一冊の答え', '18歳以上', '15歳以上', '法定代理人の同意', 'ブラウザのデータ', '有効期限内', '使った1冊', '確認コードやパスワード']) assert.ok(text.includes(expected), expected)
  for (const forbidden of ['App Store', 'Apple Account', 'サブスクリプション', 'support@fate-lab.com', '必ず復元', '［', '］']) assert.ok(!text.includes(forbidden), forbidden)
})

test('Web support uses its own page and the common Web footer, not the iOS support component', () => {
  const app = readFileSync(new URL('../WebApp.tsx', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../pages/SupportPage.tsx', import.meta.url), 'utf8')
  const footer = readFileSync(new URL('../components/ui.tsx', import.meta.url), 'utf8')
  assert.ok(app.includes("import('./pages/SupportPage')"))
  assert.ok(!app.includes("import('../pages/SupportPage')"))
  assert.ok(page.includes('mailto:${WEB_SUPPORT_EMAIL}') && page.includes('<Footer />'))
  assert.ok(footer.includes('to="/tokushoho"'))
  assert.ok(!page.includes('to="/tokushohou"'))
  assert.ok(page.includes('秘密キー') && page.includes('個人情報'))
})
