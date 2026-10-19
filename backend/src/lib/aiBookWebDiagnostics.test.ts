import test from 'node:test'
import assert from 'node:assert/strict'
import type Anthropic from '@anthropic-ai/sdk'
import { generateBookDocument } from './aiBookGeneration.js'
import { validateBookDocument } from './aiBooks.js'
import { bookFailure } from './aiBookFailure.js'
import { inspectWebBookEvidence, WebBookDiagnosticError, webBookFailureDiagnostic } from './aiBookWebDiagnostics.js'

const text = '毎日の生活の中で無理なく続けられる小さな工夫を一つ選び、落ち着いて取り組んでください。'
const sources = [1, 2, 3].map(n => ({ id: String(n), title: '合成資料', text, version: 'fixture', evidence: [] }))
const draft = () => ({ title: '生活習慣を小さく整える', summary: text, answer: text.repeat(5), sections: sources.map(s => ({ heading: '小さな生活の工夫', body: text.repeat(3), sourceId: s.id, quote: text })), actions: [text, text] })

test('Web evidence details distinguish six existing failures without weakening validation', () => {
  const cases: Array<[string, (d: ReturnType<typeof draft>) => void]> = [
    ['SOURCE_NOT_FOUND', d => { d.sections[0].sourceId = 'unknown' }],
    ['SOURCE_REUSED', d => { d.sections[1].sourceId = '1' }],
    ['HEADING_LENGTH', d => { d.sections[0].heading = '短' }],
    ['BODY_LENGTH', d => { d.sections[0].body = '短い本文' }],
    ['QUOTE_LENGTH', d => { d.sections[0].quote = '短い引用' }],
    ['QUOTE_NOT_VERBATIM', d => { d.sections[0].quote = '原文に存在しない合成の引用文です。' }],
  ]
  for (const [reason, mutate] of cases) {
    const d = draft(); mutate(d)
    assert.throws(() => validateBookDocument(d, sources), /BOOK_DOCUMENT_EVIDENCE/)
    const detail = inspectWebBookEvidence(d, sources)
    assert.equal(detail.reason, reason)
    assert.equal(detail.sectionIndex, reason === 'SOURCE_REUSED' ? 1 : 0)
    assert.deepEqual(Object.keys(detail).sort(), ['reason', 'sectionIndex', 'stage'])
    assert.ok(!JSON.stringify(detail).includes(text))
  }
})

test('Web diagnostics preserve requests, generic failure code, retry policy and native behavior', async () => {
  const d = draft(); d.sections[0].quote = '原文に存在しない合成の引用文です。'
  const requests: unknown[] = [], errors: unknown[] = []
  const client = { messages: { create: async (req: unknown) => {
    requests.push(req)
    return { stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 20 }, content: [{ type: 'tool_use', name: 'submit_book', input: d }] }
  } } } as unknown as Anthropic
  for (const enabled of [false, true]) {
    try { await generateBookDocument(client, 'fixture', { question: text, theme: 'その他', sources }, async () => {}, { webDiagnostics: enabled }); assert.fail() }
    catch (e) { errors.push(e) }
  }
  assert.deepEqual(requests[0], requests[1])
  assert.deepEqual(bookFailure(errors[0]), bookFailure(errors[1]))
  assert.equal(webBookFailureDiagnostic('web', errors[0]), undefined)
  for (const native of ['member', 'purchase', 'trial', 'review', undefined]) assert.equal(webBookFailureDiagnostic(native, errors[1]), undefined)
  assert.deepEqual(webBookFailureDiagnostic('web', errors[1]), { stage: 'evidence', reason: 'QUOTE_NOT_VERBATIM', sectionIndex: 0 })
})

test('untrusted exception payload and extra fields cannot enter diagnostic logs', () => {
  assert.equal(webBookFailureDiagnostic('web', { message: 'secret', detail: { stage: 'evidence', reason: 'QUOTE_NOT_VERBATIM' } }), undefined)
  const error = new WebBookDiagnosticError({ stage: 'evidence', reason: 'SOURCE_NOT_FOUND', sectionIndex: 0 })
  Object.assign(error.detail, { sourceId: 'private', text: 'secret', token: 'secret' })
  assert.deepEqual(webBookFailureDiagnostic('web', error), { stage: 'evidence', reason: 'SOURCE_NOT_FOUND', sectionIndex: 0 })
})
