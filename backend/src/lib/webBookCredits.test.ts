import test from 'node:test'
import assert from 'node:assert/strict'
import { countAvailableBookCredits } from './webBookCredits.js'
test('Web credits exclude all iOS/member/review/trial allocations and invalid dates', () => {
  const base = {starts_at:'2020-01-01',expires_at:null,ai_book_credits:[{consumed_by:null,recovery_until:null}]}
  const result = countAvailableBookCredits(['member','purchase','review','trial','web'].map(source => ({...base,source})))
  assert.equal(result.remaining, 1)
  assert.equal(result.memberRemaining, 0)
  assert.equal(countAvailableBookCredits([{...base,source:'web',starts_at:'invalid'}]).remaining, 0)
  assert.equal(countAvailableBookCredits([{...base,source:'web',expires_at:'2020-01-02'}]).remaining, 0)
})
