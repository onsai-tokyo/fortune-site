import test from 'node:test'
import assert from 'node:assert/strict'
import { keepReadingVisible, visibleYearSections } from './readingPresentation'

test('hide evidence section in presentation without removing stored source evidence', () => {
  const sections = [{ heading: 'この年の流れ', body: '本文' }, { heading: '根拠と期間', body: '計算根拠' }]
  assert.deepEqual(visibleYearSections(sections), [sections[0]])
  assert.equal(sections.length, 2)
})
test('keep complete readings on background refresh, never show empty or different-owner initial state', () => {
  assert.equal(keepReadingVisible('ready', [{}], [{}]), true)
  assert.equal(keepReadingVisible('loading', [], []), false)
  assert.equal(keepReadingVisible('error', [], []), false)
  assert.equal(keepReadingVisible('ready', [], [{}]), false)
})
