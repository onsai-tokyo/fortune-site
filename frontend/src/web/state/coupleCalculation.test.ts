import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoupleCalculation } from './coupleCalculation'

test('a late old response cannot overwrite a newer couple calculation', async () => {
  const calculate = createCoupleCalculation()
  const published: string[] = []
  let finishOld!: (value: string) => void
  let oldSignal!: AbortSignal
  const old = calculate(signal => {
    oldSignal = signal
    return new Promise<string>(resolve => { finishOld = resolve })
  }, result => published.push(result))
  const rejected = assert.rejects(old, { name: 'AbortError' })
  assert.equal(await calculate(async () => 'new', result => published.push(result)), 'new')
  assert.equal(oldSignal.aborted, true)
  finishOld('old')
  await rejected
  assert.deepEqual(published, ['new'])
})

test('leaving the form aborts the request and ignores a late response', async () => {
  const calculate = createCoupleCalculation()
  const page = new AbortController()
  let finish!: (value: string) => void
  let transportSignal!: AbortSignal
  const pending = calculate(signal => {
    transportSignal = signal
    return new Promise<string>(resolve => { finish = resolve })
  }, () => assert.fail('cancelled result was published'), page.signal)
  const rejected = assert.rejects(pending, { name: 'AbortError' })
  page.abort()
  assert.equal(transportSignal.aborted, true)
  finish('late')
  await rejected
})

test('an already cancelled form never starts a calculation', async () => {
  const page = new AbortController()
  page.abort()
  await assert.rejects(createCoupleCalculation()(async () => {
    assert.fail('request started after leaving')
  }, () => assert.fail(), page.signal), { name: 'AbortError' })
})

test('a successful result is published once and does not cancel a later request', async () => {
  const calculate = createCoupleCalculation()
  const page = new AbortController()
  const published: number[] = []
  assert.equal(await calculate(async () => 1, value => published.push(value), page.signal), 1)
  page.abort()
  assert.equal(await calculate(async signal => {
    assert.equal(signal.aborted, false)
    return 2
  }, value => published.push(value)), 2)
  assert.deepEqual(published, [1, 2])
})
