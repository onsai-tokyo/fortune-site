import test from 'node:test'
import assert from 'node:assert/strict'
import { aiDataPolicyLinks, collectedInformation, commerceRows, crossBorderNotice, privacyIntro, privacySections, processors, termsSections } from './legalContent'

test('revised Web legal text retains all articles and preparation notices, not draft introduction', () => {
  assert.equal(termsSections.filter(s => s.title.startsWith('第')).length, 15)
  assert.equal(privacySections.filter(s => s.title.startsWith('第')).length, 10) // Article 1 is the data table.
  assert.equal(collectedInformation.length, 7)
  const text = JSON.stringify({ termsSections, privacySections, commerceRows })
  assert.ok(text.includes('現在、ブックの販売は準備中で、購入はできません'))
  assert.ok(text.includes('もとの相談文、ブックの本文も送ります'))
  assert.ok(text.includes('本サービス内の冊数と購入の記録も消えます'))
  assert.ok(!text.includes('この下書きについて'))
  assert.ok(text.includes('onsai.tokyo@gmail.com'))
  assert.ok(!text.includes('［6か月］')) // No unapproved expiry is published.
  assert.equal(termsSections.find(s => s.id === 'ai-consultation')?.title, '第9条（AIで生成される文章）')
})
test('verified provider and database region are retained without inventing a payment provider', () => {
  assert.deepEqual(processors.find(row => row[0].startsWith('Resend')), ['Resend（Plus Five Five, Inc.）', '確認コードのメール送信', '米国'])
  assert.ok(processors.find(row => row[0] === 'Supabase, Inc.')?.[2].includes('日本・東京、ap-northeast-1'))
  assert.ok(!processors.some(row => /決済/.test(row[0])), 'do not name an unselected payment processor')
})
test('public sales-preparation copy contains no draft brackets or unsupported commercial terms', () => {
  const text = JSON.stringify({ termsSections, privacyIntro, privacySections, processors, collectedInformation, commerceRows, crossBorderNotice })
  assert.ok(!/[［］]/.test(text))
  for (const note of ['この下書きについて', 'この項を削除', 'この行を削除', '契約条件と保存期間を確認する', '動作確認した環境に合わせる']) assert.ok(!text.includes(note))
  assert.ok(!text.includes('購入日から6か月') && !text.includes('有効期限はありません'))
  assert.ok(!text.includes('当社との契約に基づき、送られた情報をAIの学習に使いません'))
  assert.ok(!text.includes('最後の利用から'), 'unapproved inactive-account cleanup is not published as a policy')
  assert.ok(!text.includes('東京地方裁判所'), 'do not designate an unapproved exclusive court')
  assert.ok(text.includes('販売開始前') && text.includes('ブックについての質問を2回'))
})
test('AI statements identify a public commercial policy with exceptions, not a verified private agreement', () => {
  const text = privacySections.find(s => s.title.startsWith('第3条'))!.paragraphs.join('\n')
  assert.ok(text.includes('商用API向け公開方針') && text.includes('例外'))
  assert.ok(text.includes('保存期間') && !text.includes('保存しません'))
  assert.equal(aiDataPolicyLinks.length, 2)
  for (const link of aiDataPolicyLinks) assert.equal(new URL(link.href).hostname, 'privacy.claude.com')
})
test('approved contact and disclosure wording do not invent an address or publication date', () => {
  const text = JSON.stringify({ termsSections, privacySections, commerceRows })
  assert.ok(text.includes('山崎愛美') && text.includes('onsai.tokyo@gmail.com'))
  for (const label of ['所在地', '電話番号']) assert.ok(commerceRows.find(row => row[0] === label)?.[1].includes('請求があれば遅滞なく開示します'))
  assert.ok(text.includes('Web版の公開日から適用します'))
  for (const placeholder of ['［代表者の氏名］', '［所在地］', '［施行日］', '［問い合わせ用メールアドレス］']) assert.ok(!text.includes(placeholder))
})
