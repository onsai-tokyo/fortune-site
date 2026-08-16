import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPublicReadingShare } from './readingShare.js'

test('共有要点に出生情報・鑑定全文・内部IDを含めない', () => {
  const share = buildPublicReadingShare({
    id: 'internal-report-id', secret_token: 'private-secret', title: '鑑定結果について',
    birth_data: { birthDate: '1995-02-20', birthplace: '愛知県', gender: 'female' },
    calculated_data: { elementBalance: { 木: 1, 火: 2, 土: 3, 金: 4, 水: 5 }, privateValue: 'hidden' },
    report_text: '先に読む要約\n[[HIGHLIGHT:1995年2月20日 愛知県 女性 慎重さと行動力を併せ持つ人]]\n2系統で一致\n非公開の鑑定全文',
  })
  const serialized = JSON.stringify(share)
  assert.equal(share.tagline, '慎重さと行動力を併せ持つ人')
  assert.equal(share.familyCount, 2)
  assert.deepEqual(share.elements, { 木: 1, 火: 2, 土: 3, 金: 4, 水: 5 })
  for (const forbidden of ['1995-02-20', '愛知県', 'female', 'internal-report-id', 'private-secret', '非公開の鑑定全文', 'hidden']) {
    assert.equal(serialized.includes(forbidden), false)
  }
})
