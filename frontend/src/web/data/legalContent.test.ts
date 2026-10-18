import test from 'node:test'
import assert from 'node:assert/strict'
import { collectedInformation, commerceRows, privacySections, processors, termsSections } from './legalContent'

test('revised Web legal text retains all articles and preparation notices, not draft introduction', () => {
  assert.equal(termsSections.filter(s => s.title.startsWith('第')).length, 15)
  assert.equal(privacySections.filter(s => s.title.startsWith('第')).length, 10) // Article 1 is the data table.
  assert.equal(collectedInformation.length, 7)
  const text = JSON.stringify({ termsSections, privacySections, commerceRows })
  assert.ok(text.includes('現在、ブックの販売は準備中で、購入はできません'))
  assert.ok(text.includes('もとの相談文、ブックの本文も送ります'))
  assert.ok(text.includes('本サービス内の冊数と購入の記録も消えます'))
  assert.ok(!text.includes('この下書きについて'))
  assert.ok(text.includes('［問い合わせ用メールアドレス］'))
  assert.ok(text.includes('［6か月］')) // Not an approved expiry or an expiry implementation.
  assert.equal(termsSections.find(s => s.id === 'ai-consultation')?.title, '第9条（AIで生成される文章）')
})
test('only verified provider and database region placeholders are filled', () => {
  assert.deepEqual(processors.find(row => row[0].startsWith('Resend')), ['Resend（Plus Five Five, Inc.）', '確認コードのメール送信', '米国'])
  assert.ok(processors.find(row => row[0] === 'Supabase, Inc.')?.[2].includes('日本・東京、ap-northeast-1'))
  assert.ok(processors.some(row => row[0] === '［決済代行会社］'))
})
