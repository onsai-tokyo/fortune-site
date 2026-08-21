import assert from 'node:assert/strict'
import test from 'node:test'
import { generateCompatibilityCards, parseCompatibility } from './partners.js'

const pages = Array.from({ length: 8 }, (_, index) => ({ role: index === 0 ? 'opening' : index === 7 ? 'closing' : 'core', label: `頁${index}`, text: `二人の関係を読む場面${index}。` }))
const card = (id: string) => ({ id, kind: 'essence', title: `${id}で見える二人の関係`, summary: '二人の関係を読みます。', tags: ['相性'], period: null, evidence: [], pages })
const valid = JSON.stringify({ cards: [card('core'), card('shadow'), card('action')] })

test('コードフェンス・前後文・末尾カンマを除去して相性JSONを復元する', () => {
  const raw = `説明\n\`\`\`json\n${valid.replace(/}]}/, '},]}')}\n\`\`\``
  assert.equal(parseCompatibility(raw).cards.length, 3)
})

const singleCard = (id: string, pageCount = 8) => JSON.stringify({ card: { ...card(id), pages: pages.slice(0, pageCount) } })

test('3枚を独立生成し、1枚が失敗しても成功した2枚を返す', async () => {
  const report = await generateCompatibilityCards('prompt', async (_prompt, spec) => {
    if (spec.id === 'compat-friction') return { text: '{"card":', stopReason: 'end_turn' }
    return { text: singleCard(spec.id), stopReason: 'end_turn' }
  })
  assert.equal(report.cards.length, 2)
  assert.deepEqual(report.cards.map(item => item.id), ['compat-attraction', 'compat-growth'])
})

test('max_tokens時は壊れたJSONの修復ではなく該当カードだけ再生成する', async () => {
  const attempts = new Map<string, number>()
  const prompts: string[] = []
  const report = await generateCompatibilityCards('prompt', async (prompt, spec, attempt) => {
    prompts.push(prompt)
    attempts.set(spec.id, attempt)
    if (spec.id === 'compat-attraction' && attempt === 1) return { text: '{"card":', stopReason: 'max_tokens' }
    return { text: singleCard(spec.id), stopReason: 'end_turn' }
  })
  assert.equal(report.cards.length, 3)
  assert.equal(attempts.get('compat-attraction'), 2)
  assert.match(prompts.find(item => item.includes('前回の出力')) ?? '', /最初から生成し直して/)
})

test('再生成では6ページ以上のカードを救済する', async () => {
  const report = await generateCompatibilityCards('prompt', async (_prompt, spec, attempt) => {
    if (spec.id === 'compat-growth' && attempt === 1) return { text: singleCard(spec.id, 6), stopReason: 'end_turn' }
    if (spec.id === 'compat-growth') return { text: singleCard(spec.id, 6), stopReason: 'end_turn' }
    return { text: singleCard(spec.id), stopReason: 'end_turn' }
  })
  assert.equal(report.cards.length, 3)
  assert.equal(report.cards.find(item => item.id === 'compat-growth')?.pages.length, 6)
})
