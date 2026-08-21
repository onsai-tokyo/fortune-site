import assert from 'node:assert/strict'
import test from 'node:test'
import { generateCompatibilityReport, parseCompatibility } from './partners.js'

const pages = Array.from({ length: 8 }, (_, index) => ({ role: index === 0 ? 'opening' : index === 7 ? 'closing' : 'core', label: `頁${index}`, text: `二人の関係を読む場面${index}。` }))
const card = (id: string) => ({ id, kind: 'essence', title: `${id}で見える二人の関係`, summary: '二人の関係を読みます。', tags: ['相性'], period: null, evidence: [], pages })
const valid = JSON.stringify({ cards: [card('core'), card('shadow'), card('action')] })

test('コードフェンス・前後文・末尾カンマを除去して相性JSONを復元する', () => {
  const raw = `説明\n\`\`\`json\n${valid.replace(/}]}/, '},]}')}\n\`\`\``
  assert.equal(parseCompatibility(raw).cards.length, 3)
})

test('壊れたJSONは一度だけ修復生成してから検証する', async () => {
  let calls = 0
  const report = await generateCompatibilityReport('prompt', async () => (++calls === 1 ? '{"cards":[' : valid))
  assert.equal(calls, 2)
  assert.equal(report.generator, 'ai')
})
