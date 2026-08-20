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
