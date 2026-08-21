import assert from 'node:assert/strict'
import test from 'node:test'

const baseUrl = process.env.PR15_E2E_BASE_URL
const token = process.env.PR15_E2E_ACCESS_TOKEN
const enabled = Boolean(baseUrl && token)
const headers = () => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' })

test('PR15 E2E: 鑑定生成は成功し3タブすべてに内容がある', { skip: !enabled }, async () => {
  const response = await fetch(`${baseUrl}/api/preview/generate`, { method: 'POST', headers: headers(), body: JSON.stringify({ birthDate: '1995-02-20', birthTime: '03:02', birthplace: '愛知県名古屋市', gender: 'female' }) })
  assert.equal(response.status, 200)
  const report = await response.json() as { cards: Array<{ tab?: string; pages?: unknown[] }> }
  for (const tab of ['essence', 'timing', 'chart']) assert.ok(report.cards.some(card => card.tab === tab))
  assert.ok(report.cards.some(card => (card.pages?.length ?? 0) >= 10))
})

test('PR15 E2E: チャット・履歴詳細・相性は401/402/429/500を返さない', { skip: !enabled }, async () => {
  const conversationId = process.env.PR15_E2E_CONVERSATION_ID
  const partnerId = process.env.PR15_E2E_PARTNER_ID
  assert.ok(conversationId && partnerId, 'E2E用の鑑定IDと相手IDが必要です')
  const detail = await fetch(`${baseUrl}/api/reading/conversations/${conversationId}`, { headers: headers() })
  assert.equal(detail.status, 200)
  const chat = await fetch(`${baseUrl}/api/reading/conversations/${conversationId}/questions`, { method: 'POST', headers: headers(), body: JSON.stringify({ question: '今の仕事で力を活かすには？' }) })
  assert.ok(![401, 402, 429, 500].includes(chat.status), `chat status=${chat.status}`)
  const compatibility = await fetch(`${baseUrl}/api/partners/${partnerId}/compatibility`, { method: 'POST', headers: headers(), body: JSON.stringify({ conversationId, relationshipType: 'romantic' }) })
  assert.ok(![401, 402, 429, 500].includes(compatibility.status), `compatibility status=${compatibility.status}`)
})
