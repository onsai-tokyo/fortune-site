import test from 'node:test'
import assert from 'node:assert/strict'
import { challengeToken, requestCaptchaToken, type TurnstileApi } from './turnstile.ts'

function fixture() {
  let callbacks: Parameters<TurnstileApi['render']>[1] | undefined
  const removed: string[] = []
  let containersRemoved = 0
  const container = { remove() { containersRemoved++ } } as HTMLElement
  const api: TurnstileApi = {
    render(_container, options) { callbacks = options; return 'widget' },
    remove(id) { removed.push(id) },
  }
  return { api, container, removed, callbacks: () => callbacks!, containersRemoved: () => containersRemoved }
}

test('unset site key performs no browser or network work', async () => {
  assert.equal(await requestCaptchaToken(), undefined)
  assert.equal(await requestCaptchaToken(''), undefined)
})

test('each authentication attempt obtains its own token and removes its widget', async () => {
  for (const token of ['first-token', 'fresh-retry-token']) {
    const f = fixture()
    const result = challengeToken(f.api, f.container, 'public-site-key')
    assert.equal(f.callbacks().appearance, 'interaction-only')
    f.callbacks().callback(token)
    f.callbacks()['expired-callback']()
    assert.equal(await result, token)
    assert.deepEqual(f.removed, ['widget'])
    assert.equal(f.containersRemoved(), 1)
  }
})

test('error, expiry and timeout fail closed and clean up the widget', async () => {
  for (const callback of ['error-callback', 'expired-callback', 'timeout-callback'] as const) {
    const f = fixture()
    const result = challengeToken(f.api, f.container, 'site')
    const rejected = assert.rejects(result, /人間確認/)
    f.callbacks()[callback]()
    await rejected
    assert.deepEqual(f.removed, ['widget'])
    assert.equal(f.containersRemoved(), 1)
  }
  const f = fixture()
  await assert.rejects(challengeToken(f.api, f.container, 'site', 1), /人間確認/)
  assert.equal(f.containersRemoved(), 1)
})

test('render failure rejects instead of submitting an authentication request', async () => {
  const f = fixture()
  f.api.render = () => { throw new Error('SDK unavailable') }
  await assert.rejects(challengeToken(f.api, f.container, 'site'), /人間確認/)
  assert.equal(f.containersRemoved(), 1)
})
