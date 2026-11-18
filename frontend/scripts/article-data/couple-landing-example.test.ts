import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCoupleLandingExample } from './couple-landing-example.js'
import { coupleLandingExample } from '../../src/web/data/coupleLandingExample.js'

test('published couple example titles, tags and excerpts match the current engine', () => {
  assert.deepEqual(coupleLandingExample, buildCoupleLandingExample())
})
