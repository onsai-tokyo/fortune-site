import test from 'node:test'
import assert from 'node:assert/strict'
import { readReadingStream } from './readingStream'
import { validBirthDate } from './birthDate'
test('birth date rejects impossible calendar days and future values', () => {
  assert.equal(validBirthDate('2000-02-29'), true)
  for (const value of ['2001-02-29', '2000-04-31', '2000--01', '9999-01-01']) assert.equal(validBirthDate(value), false)
})
test('SSE progress is streamed; complete resolves before connection closes', async () => {
  const progress: number[] = []
  const encoder = new TextEncoder()
  let cancelled = false
  const response = new Response(new ReadableStream({
    start(controller) {
      for (const part of ['data: {"type":"pro', 'gress","percent":58}\r\n\r\n',
        'data: {"type":"progress","percent":76}\n\n',
        'data: {"type":"complete","report":{"reportText":"鑑定"}}\n\n']) controller.enqueue(encoder.encode(part))
    },
    cancel() { cancelled = true },
  }))
  assert.deepEqual(await readReadingStream(response, n => progress.push(n)), { reportText: '鑑定' })
  assert.deepEqual(progress, [58, 76])
  assert.equal(cancelled, true)
})
test('incomplete, failed and HTTP error responses do not become a reading', async () => {
  for (const response of [
    new Response('data: {"type":"progress","percent":5}\n\n'),
    new Response('data: {"type":"error"}\n\n'),
    new Response('{}', { status: 500 }),
  ]) await assert.rejects(readReadingStream(response, () => {}))
})
