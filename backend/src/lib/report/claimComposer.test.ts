import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSelfReport } from './buildSelfReport.js'
import { CLAIM_ASSETS } from './claimAssets.js'
import { claimTriggerMatchesFinding } from './claimComposer.js'
import { buildFixtureReportInput, type BirthFixture } from './fixtures.js'
import type { ReportFindingV2 } from './findingsV2.js'
import { extractReportMetadata } from './metadata.js'

const CASE_A: BirthFixture = {
  id: 'case-a',
  birthDate: '1995-02-20',
  birthTime: '03:02',
  birthplace: '愛知県名古屋市',
  gender: 'female',
  group: 'baseline',
}

test('化星 trigger は宮・星を含む canonical key の末尾でも一致する', () => {
  const asset = CLAIM_ASSETS.find(item => item.id === 'lm-06')
  assert.ok(asset)
  assert.equal(claimTriggerMatchesFinding(asset, {
    id: 'finding-mutagen', key: 'mutagen-父母-天機-祿', kind: 'signature', axis: 'relation',
    confidence: 0.95, lineages: ['ziwei'], systems: ['紫微斗数'], independence: 1,
    primaryFacts: ['fact-1'], supportingFacts: [],
  }), true)
})

test('Aケースの具体Claimは固有triggerなしの汎用スコア補完へ落ちない', () => {
  const input = buildFixtureReportInput(CASE_A)
  const output = buildSelfReport(input, extractReportMetadata(input), { factPipeline: 'v2', narrativeEngine: 'blocks' })
  const assets = new Map(CLAIM_ASSETS.map(asset => [asset.id, asset]))

  for (const card of output.report.cards.filter(item => item.kind === 'essence')) {
    for (const section of card.sections ?? []) {
      assert.ok(section.claimId, `${card.id}: claimId がありません`)
      const asset = assets.get(section.claimId!)
      assert.ok(asset, `${card.id}/${section.claimId}: ClaimAsset がありません`)
      if (asset.trigger.kind === 'axis' || asset.trigger.kind === 'score') continue
      assert.ok(
        output.findings.some(finding => claimTriggerMatchesFinding(asset, finding as ReportFindingV2)),
        `${card.id}/${asset.id}: ${asset.trigger.kind} trigger が成立していないのに掲載されています`,
      )
    }
  }

  const sourceRefs = output.report.cards.flatMap(card => card.metadataRefs ?? [])
    .filter(ref => ref.startsWith('claim-source:'))
  assert.ok(sourceRefs.length > 0)
  assert.ok(sourceRefs.includes('claim-source:direct'))
})
