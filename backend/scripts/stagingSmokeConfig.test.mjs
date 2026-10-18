import assert from 'node:assert/strict'
import test from 'node:test'
import { expectedCommitFrom } from './stagingSmokeConfig.mjs'
const sha = '1234567890abcdef1234567890abcdef12345678'
test('requires an explicit full SHA before smoke can start', () => {
  for (const env of [{}, { STAGING_EXPECTED_COMMIT: 'a33f17c' }]) assert.throws(() => expectedCommitFrom([], env))
})
test('accepts env or argument, normalizes case, argument takes priority', () => {
  assert.equal(expectedCommitFrom([], { STAGING_EXPECTED_COMMIT: sha }), sha)
  assert.equal(expectedCommitFrom(['--expected-commit', sha.toUpperCase()], { STAGING_EXPECTED_COMMIT: 'bad' }), sha)
})
test('rejects missing values, duplicates and unknown arguments', () => {
  for (const args of [['--expected-commit'], ['--bad', sha], ['--expected-commit', sha, '--expected-commit', sha]]) assert.throws(() => expectedCommitFrom(args))
})
