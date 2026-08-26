import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ageInYear, calcAge, periodLabel } from './age.js'

test('誕生日の前後で1歳変わる', () => {
  const birth = '1995-02-25'
  assert.equal(calcAge(birth, new Date('2026-02-24T12:00:00+09:00')), 30)
  assert.equal(calcAge(birth, new Date('2026-02-25T00:00:00+09:00')), 31)
  assert.equal(calcAge(birth, new Date('2026-08-26T12:00:00+09:00')), 31)
})

test('UTCの日時でも日本時間の暦日で判定する', () => {
  assert.equal(calcAge('1995-02-25', new Date('2026-02-24T16:00:00Z')), 31)
})

test('年齢と期間ラベルを一意に表す', () => {
  assert.equal(ageInYear('1995-02-25', 2027), 32)
  assert.equal(periodLabel('1995-02-25', 2027, new Date('2026-08-26T00:00:00+09:00')), '2027年（32歳になる年）')
})

test('年齢計算の重複実装が残っていない', () => {
  const src = path.dirname(fileURLToPath(import.meta.url))
  const root = path.resolve(src, '..')
  const files: string[] = []
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(full)
      else if (entry.name.endsWith('.ts')) files.push(full)
    }
  }
  visit(root)
  const duplicates = files.filter(file => file !== fileURLToPath(import.meta.url) && file !== path.join(src, 'age.ts'))
    .filter(file => /getFullYear\(\)\s*-/.test(fs.readFileSync(file, 'utf8')))
  assert.deepEqual(duplicates, [])
})
