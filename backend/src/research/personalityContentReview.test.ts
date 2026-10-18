import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allReviewedParts, buildReviewedCandidate, describeMonthBands, reviewTextPart, REVIEW_CHAPTERS, REVIEW_ROWS } from './personalityContentReview.js'
import { renderLifeAxis } from './lifeAxis.js'

test('all 622 source parts remain traceable; withheld is not replaced and unreviewed is not approved', () => {
  const parts = allReviewedParts()
  assert.equal(parts.length, 622)
  assert.equal(new Set(parts.map(p => p.claimID)).size, 622)
  assert.ok(parts.some(p => p.status === 'withheld'))
  assert.ok(parts.some(p => p.status === 'unreviewed'))
  for (const part of parts) {
    assert.ok(part.originalText)
    assert.equal(part.publishableText, null)
    assert.equal(part.productionEligible, false)
    assert.equal(part.allowedMeaning, null)
    if (part.status === 'withheld') { assert.equal(part.inspectionText, null); assert.ok(part.relatedIssueIds.length) }
    else assert.equal(part.inspectionText, part.originalText)
  }
  assert.throws(() => reviewTextPart('new.unreviewed.claim'))
})

test('all 4,800 chapters retain structure and identifiers while withholding relational claims at every layer', () => {
  const keys = new Set<string>()
  for (const row of REVIEW_ROWS) for (const ch of REVIEW_CHAPTERS) {
    const result = buildReviewedCandidate(row, ch.id)
    keys.add(result.stableKey)
    assert.equal(result.productionEligible, false)
    assert.equal(result.interpretationTitle, null)
    assert.deepEqual(result.conditions, row)
    for (const field of ['title', 'opening', 'section1', 'section2', 'section4', 'section5', 'section6', 'advice']) {
      assert.equal(result.sections.find(s => s.field === field)?.status, 'withheld', `${result.stableKey}:${field}`)
    }
    assert.deepEqual(result.sections.find(s => s.field === 'section3')?.calculationSelectors, { centerStar: row.centerStar })
  }
  assert.equal(keys.size, 4800)
})

test('K003 and K008 frozen reference keys both map to withheld advice; no opposite advice is invented', () => {
  const regression = JSON.parse(readFileSync(new URL('./assets/personality-review-k-regression.json', import.meta.url), 'utf8')) as { K003: string[]; K008: string[] }
  assert.equal(regression.K003.length, 60); assert.equal(regression.K008.length, 60)
  for (const key of [...regression.K003, ...regression.K008]) {
    const [pattern, chapter] = key.split('::')
    const row = REVIEW_ROWS.find(r => `${r.dayPillar}-${r.centerStar}` === pattern)!
    const advice = buildReviewedCandidate(row, chapter).sections.find(s => s.field === 'advice')!
    assert.equal(advice.status, 'withheld'); assert.equal(advice.publishableText, null)
    assert.ok(advice.parts.filter(p => p.status === 'withheld').every(p => p.inspectionText === null))
  }
})

test('withdrawal and half-performance claims are held in full, preserving source words for audit only', () => {
  for (const key of ['chapters.life_axis.claim[2]', 'chapters.life_axis.titleCore[2]', 'chapters.work_style.sceneDetail[7]', 'chapters.work_style.sceneDetail[5]']) {
    const part = reviewTextPart(key)
    assert.equal(part.status, 'withheld'); assert.equal(part.inspectionText, null)
  }
})

test('month-band labels distinguish elapsed solar-term days without modifying bounds, including open-ended final band', () => {
  for (const row of REVIEW_ROWS) {
    const text = describeMonthBands(row)
    assert.ok(text.includes('経過日数'))
    assert.ok(text.includes('当月の日付ではありません'))
    assert.doesNotMatch(text, /月の\d/)
    for (const band of row.monthBands) assert.ok(text.includes(band.to === null ? `${band.from}以上` : `${band.from}〜${band.to}`))
  }
})

test('new review layer leaves old renderer unchanged and rejects unknown structure', () => {
  const row = REVIEW_ROWS.find(r => r.dayPillar === '壬午' && r.centerStar === '鳳閣星')!
  const original = renderLifeAxis(row)
  buildReviewedCandidate(row, 'life_axis')
  assert.deepEqual(renderLifeAxis(row), original)
  assert.ok(original.title.includes('返りが遅れて来る'))
  assert.throws(() => buildReviewedCandidate({ ...row, twelveStage: 'invented' }, 'life_axis'))
  assert.throws(() => buildReviewedCandidate(row, 'invented'))
})
