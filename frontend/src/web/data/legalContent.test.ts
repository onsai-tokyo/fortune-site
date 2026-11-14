import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { aiDataPolicyLinks, collectedInformation, commerceRows, crossBorderNotice, privacyIntro, privacySections, processors, termsSections, affiliateNotice, externalServiceNotice, webSalesNotice } from './legalContent'

test('approved Web eligibility permits ages 15+ with guardian consent below 18 across entry pages', () => {
  const eligibility = termsSections.find(s => s.title.startsWith('第2条'))!.paragraphs.join('')
  for (const text of [eligibility, ...['TopPage', 'OnboardingPage'].map(name =>
    readFileSync(new URL(`../pages/${name}.tsx`, import.meta.url), 'utf8'))]) {
    assert.match(text, /15歳以上/)
    assert.ok(text.includes('18歳未満の方は、保護者などの法定代理人の同意を得たうえでご利用ください。'))
    assert.ok(!text.includes('18歳以上の方が'))
    assert.ok(!text.includes('18歳未満の方は利用できません'))
  }
})

test('revised Web legal text retains all articles and the current service notices, not draft introduction', () => {
  assert.equal(termsSections.filter(s => s.title.startsWith('第')).length, 15)
  assert.equal(privacySections.filter(s => s.title.startsWith('第')).length, 10) // Article 1 is the data table.
  assert.equal(collectedInformation.length, 7)
  const text = JSON.stringify({ termsSections, privacySections, commerceRows })
  assert.ok(text.includes('個別相談ブックの新規作成と追加質問は休止中です'))
  assert.ok(text.includes('文章生成のため米国のAnthropic, PBC（Claude API）に送信していました'))
  assert.ok(text.includes('本サービス内のブックと冊数の記録も消えます'))
  assert.ok(!text.includes('この下書きについて'))
  assert.ok(text.includes('onsai.tokyo@gmail.com'))
  assert.ok(!text.includes('［6か月］')) // No unapproved expiry is published.
})
test('verified provider and database region are retained without inventing a payment provider', () => {
  assert.deepEqual(processors.find(row => row[0].startsWith('Resend')), ['Resend（Plus Five Five, Inc.）', '確認コードのメール送信', '米国'])
  assert.ok(processors.find(row => row[0] === 'Supabase, Inc.')?.[2].includes('日本・東京、ap-northeast-1'))
  assert.ok(!processors.some(row => /決済/.test(row[0])), 'do not name an unselected payment processor')
})
test('public legal copy contains no draft brackets or unsupported commercial terms', () => {
  const text = JSON.stringify({ termsSections, privacyIntro, privacySections, processors, collectedInformation, commerceRows, crossBorderNotice })
  assert.ok(!/[［］]/.test(text))
  for (const note of ['この下書きについて', 'この項を削除', 'この行を削除', '契約条件と保存期間を確認する', '動作確認した環境に合わせる']) assert.ok(!text.includes(note))
  assert.ok(!text.includes('購入日から6か月'))
  assert.ok(!text.includes('当社との契約に基づき、送られた情報をAIの学習に使いません'))
  assert.ok(!text.includes('最後の利用から'), 'unapproved inactive-account cleanup is not published as a policy')
  assert.ok(!text.includes('東京地方裁判所'), 'do not designate an unapproved exclusive court')
  assert.doesNotMatch(text, /販売開始前|1,000円|GMOイプシロン/)
})
test('free Web service and third-party terms are disclosed consistently', () => {
  assert.match(webSalesNotice, /無料.*休止中/)
  assert.match(commerceRows.find(([label]) => label === '利用料金')![1], /^無料/)
  const disclosure = termsSections.find(s => s.title.startsWith('第6条'))!.paragraphs
  for (const notice of [affiliateNotice, externalServiceNotice]) {
    assert.ok(disclosure.includes(notice))
    assert.ok(commerceRows.some(([, text]) => text === notice))
  }
  assert.ok(!processors.some(([provider]) => provider.includes('Anthropic')))
})
test('past AI processing links to the published commercial policies', () => {
  const text = privacySections.find(s => s.title.startsWith('第3条'))!.paragraphs.join('\n')
  assert.ok(text.includes('個別相談ブックの提供時') && text.includes('新規の相談や質問を受け付けていません'))
  assert.equal(aiDataPolicyLinks.length, 2)
  for (const link of aiDataPolicyLinks) assert.equal(new URL(link.href).hostname, 'privacy.claude.com')
})
test('Web legal pages provide a request channel for operator details', () => {
  const text = JSON.stringify({ termsSections, privacySections, commerceRows })
  assert.doesNotMatch(text, /山崎愛美|コノトラビル|050-1786-5550/)
  assert.doesNotMatch(JSON.stringify(commerceRows), /温齋株式会社/)
  assert.equal(commerceRows.find(([label]) => label === 'メールアドレス')?.[1], 'onsai.tokyo@gmail.com')
  assert.match(commerceRows.find(([label]) => label === '運営情報のご請求')?.[1] ?? '', /正式名称.*ご請求に応じて.*遅滞なく開示/)
  const contact = privacySections.find(s => s.title === '問い合わせ窓口')?.paragraphs.join(' ') ?? ''
  assert.match(contact, /住所および代表者の氏名.*遅滞なく/)
  assert.match(contact, /改定内容は本ページでの公開日から適用します/)
})
