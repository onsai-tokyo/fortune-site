import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { japanDate } from '../seo/lastmod.js'

test('full builds keep the ledger unchanged and a single article body edit updates only that entry', { timeout: 90000 }, t => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'fatelab-lastmod-build-'))
  const fixture = path.join(workspace, 'frontend')
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }))
  fs.cpSync(root, fixture, { recursive: true, filter: source => {
    const name = path.basename(source)
    return !['node_modules', 'dist', '.vercel'].includes(name) && !name.startsWith('.env')
  } })
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir')
  fs.symlinkSync(path.resolve(root, '../backend'), path.join(workspace, 'backend'), 'dir')
  const ledger = path.join(fixture, 'seo/lastmod.json')
  const historical = JSON.parse(fs.readFileSync(ledger, 'utf8'))
  historical['/guides/unknown-birth-time'].lastmod = '2026-01-01'
  fs.writeFileSync(ledger, JSON.stringify(historical, null, 2) + '\n')
  const before = fs.readFileSync(ledger, 'utf8')
  const build = () => execFileSync('npm', ['run', 'build'], { cwd: fixture, timeout: 25000, stdio: 'pipe' })
  build()
  assert.equal(fs.readFileSync(ledger, 'utf8'), before)
  build()
  assert.equal(fs.readFileSync(ledger, 'utf8'), before)
  const script = path.join(fixture, 'build-script.js')
  const original = fs.readFileSync(script, 'utf8')
  const sentence = '正午など仮の時刻を入れる方法もありますが、確定結果と誤解しやすくなります。'
  assert.equal(original.split(sentence).length, 2)
  fs.writeFileSync(script, original.replace(sentence, sentence + 'テスト用に本文を追記しました。'))
  build()
  const a = JSON.parse(before), b = JSON.parse(fs.readFileSync(ledger, 'utf8'))
  const changed = Object.keys(b).filter(route => JSON.stringify(a[route]) !== JSON.stringify(b[route]))
  assert.deepEqual(changed, ['/guides/unknown-birth-time'])
  assert.equal(b[changed[0]].lastmod, japanDate())
  assert.notEqual(a[changed[0]].lastmod, b[changed[0]].lastmod)
  const html = fs.readFileSync(path.join(fixture, 'dist/guides/unknown-birth-time/index.html'), 'utf8')
  assert.ok(html.includes(`最終更新日：${b[changed[0]].lastmod}`))
  assert.ok(html.includes(`"dateModified":"${b[changed[0]].lastmod}"`))
  const sitemap = fs.readFileSync(path.join(fixture, 'dist/sitemap-guides.xml'), 'utf8')
  assert.ok(sitemap.includes(`<loc>https://fate-lab.com${changed[0]}</loc><lastmod>${b[changed[0]].lastmod}</lastmod>`))
})
