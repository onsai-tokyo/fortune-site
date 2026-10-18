import test from 'node:test'
import assert from 'node:assert/strict'
import { projectTimingMonth } from './timingMonthProjection.js'
import { buildMonthlyStemBranchEvidence } from './timingMonthlyStemBranchEvidence.js'
import { calcTimingCycles } from '../divination/index.js'
const input = { birthYear: 1990, birthMonth: 3, birthDay: 14, birthHour: 8, birthMinute: 20, gender: 'female' as const }
test('flow indices 0/10/11 project to February/December/next January', () => {
  assert.equal(projectTimingMonth(2025, 0).key, '2025-02')
  assert.equal(projectTimingMonth(2025, 10).key, '2025-12')
  assert.equal(projectTimingMonth(2025, 11).key, '2026-01')
  for (const index of [-1, 12, 1.5, NaN]) assert.throws(() => projectTimingMonth(2025, index))
})
test('43 flow years have 516 unique months, not 43 complete civil years', () => {
  const annual = calcTimingCycles(1990, 3, 14, 8, 20, 'female').annual
  const result = buildMonthlyStemBranchEvidence({ ...input, annual })
  const first = annual[0].year, last = annual.at(-1)!.year
  assert.equal(result.size, 516)
  assert.equal(result.has(`${first}-01`), false)
  assert.ok(result.has(`${last + 1}-01`))
  const january = result.get(`${first + 1}-01`)!
  assert.ok(january.every(item => item.timeProjection.sourceYear === first && !item.timeProjection.qualityEligible && item.id.endsWith(`${first + 1}-1`)))
  const reversed = buildMonthlyStemBranchEvidence({ ...input, annual: [...annual].reverse() })
  assert.deepEqual([...result.entries()].sort(), [...reversed.entries()].sort())
  assert.throws(() => buildMonthlyStemBranchEvidence({ ...input, annual: [annual[0], annual[0]] }), /Duplicate/)
})
