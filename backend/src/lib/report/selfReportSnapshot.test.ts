import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildReportFacts } from './facts.js'
import { buildReportFindings } from './findings.js'
import { buildEditorialStructuredReport } from './editorial.js'
import { replaceTimingCards } from './timingCards.js'
import { extractReportMetadata } from './metadata.js'
import { buildSelfReport, DEFAULT_SELF_REPORT_OPTIONS, resolveSelfReportOptions, selfReportPipelineTag } from './buildSelfReport.js'
import { measureCorpusQuality, measureReportQuality, type CorpusSample } from './qualityMetrics.js'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const snapshotPath = resolve(backendRoot, 'src/lib/report/__snapshots__/selfReports.json')

/** 生成が重いので1度だけ回して使い回す */
const samples: CorpusSample[] = BIRTH_FIXTURES.map(fixture => {
  const input = buildFixtureReportInput(fixture)
  const metadata = extractReportMetadata(input)
  const result = buildSelfReport(input, metadata)
  return { id: fixture.id, report: result.report, findings: result.findings }
})

// ────────────────────────────────────────────────
// PR-0a: 抽出が挙動を変えていないことの証明
// ────────────────────────────────────────────────

test('PR-0a: buildSelfReport は preview.ts の旧経路と同一の StructuredReport を返す', () => {
  for (const fixture of BIRTH_FIXTURES.slice(0, 8)) {
    const input = buildFixtureReportInput(fixture)
    const metadata = extractReportMetadata(input)

    // 旧経路をこの場で再現する
    const facts = buildReportFacts(input, metadata)
    const findings = buildReportFindings(facts)
    const legacy = replaceTimingCards(buildEditorialStructuredReport(facts, findings), input)

    const extracted = buildSelfReport(input, metadata)
    assert.deepEqual(extracted.report, legacy, `${fixture.id}: 抽出後の出力が旧経路と一致しません`)
  }
})

test('PR-0a: 既定オプションは v1 / legacy であり、環境変数の不正値は既定へ落ちる', () => {
  assert.deepEqual(DEFAULT_SELF_REPORT_OPTIONS, { factPipeline: 'v1', narrativeEngine: 'legacy' })
  assert.deepEqual(resolveSelfReportOptions({}), DEFAULT_SELF_REPORT_OPTIONS)
  assert.deepEqual(resolveSelfReportOptions({ FACT_PIPELINE: 'v3', NARRATIVE_ENGINE: 'wat' }), DEFAULT_SELF_REPORT_OPTIONS)
  assert.deepEqual(resolveSelfReportOptions({ FACT_PIPELINE: 'v2' }).factPipeline, 'v2')
})

test('PR-1: V2 Fact経路を明示指定でき、未実装の本文経路は明示的に失敗する', () => {
  const input = buildFixtureReportInput(BIRTH_FIXTURES[0])
  const metadata = extractReportMetadata(input)
  const v2 = buildSelfReport(input, metadata, { factPipeline: 'v2', narrativeEngine: 'legacy' })
  assert.equal(v2.pipelineTag, 'fact:v2|narrative:legacy')
  assert.ok(v2.facts.length > 0)
  assert.throws(() => buildSelfReport(input, metadata, { factPipeline: 'v1', narrativeEngine: 'blocks' }), /PR-2/)
})

test('PR-0a: 経路タグはキャッシュ署名に使える形で経路を区別する', () => {
  assert.notEqual(
    selfReportPipelineTag({ factPipeline: 'v1', narrativeEngine: 'legacy' }),
    selfReportPipelineTag({ factPipeline: 'v2', narrativeEngine: 'legacy' }),
  )
})

test('PR-0a: preview.ts は buildSelfReport 経由で生成し、旧呼び出しを残していない', () => {
  const preview = readFileSync(resolve(backendRoot, 'src/routes/preview.ts'), 'utf8')
  assert.match(preview, /buildSelfReport\(/, 'preview.ts が buildSelfReport を使っていません')
  assert.doesNotMatch(preview, /buildEditorialStructuredReport\(/, 'preview.ts に旧経路が残っています')
  assert.doesNotMatch(preview, /replaceTimingCards\(/, 'preview.ts に旧経路が残っています')
})

test('PR-0b: fixtures は preview.ts と同じ占術関数から ReportInput を組む', () => {
  const preview = readFileSync(resolve(backendRoot, 'src/routes/preview.ts'), 'utf8')
  const fixtures = readFileSync(resolve(backendRoot, 'src/lib/report/fixtures.ts'), 'utf8')
  for (const name of [
    'calcShichu', 'calcNayin', 'calcSanmei', 'calcExpandedDivination', 'getSukuyo', 'calcHonmeiStar',
    'calcKyuseiProfile', 'calcLifePathNumber', 'calcNumerologyProfile', 'calcTimingCycles',
    'calcSanmeiRelations', 'calcZiwei', 'calcAstrology',
  ]) {
    assert.match(preview, new RegExp(`${name}\\(`), `preview.ts が ${name} を使っていません`)
    assert.match(fixtures, new RegExp(`${name}\\(`), `fixtures.ts が ${name} を使っていません（preview.ts と乖離）`)
  }
})

// ────────────────────────────────────────────────
// PR-0b: 再現性と、以降のPRの判定土台
// ────────────────────────────────────────────────

test('PR-0b: 同一入力は常に同一の鑑定書を返す', () => {
  for (const fixture of BIRTH_FIXTURES.slice(0, 12)) {
    const input = buildFixtureReportInput(fixture)
    const metadata = extractReportMetadata(input)
    const first = buildSelfReport(input, metadata).report
    const second = buildSelfReport(input, metadata).report
    assert.deepEqual(first, second, `${fixture.id}: 同一入力で結果が変わりました`)
  }
})

test('PR-0b: 出生時刻なしの鑑定書に、時刻依存の根拠が混入しない', () => {
  for (const fixture of BIRTH_FIXTURES.filter(item => item.birthTime === null)) {
    const input = buildFixtureReportInput(fixture)
    const metadata = extractReportMetadata(input)
    const { facts } = buildSelfReport(input, metadata)
    const leaked = facts.filter(fact => fact.requiresBirthTime)
    assert.equal(leaked.length, 0, `${fixture.id}: 時刻依存Factが ${leaked.length} 件残っています`)
  }
})

test('PR-0b: 保存形式（StructuredReport の契約）を壊していない', () => {
  for (const sample of samples) {
    assert.equal(typeof sample.report.version, 'number')
    assert.ok(Array.isArray(sample.report.cards))
    assert.equal(typeof sample.report.reportText, 'string')
    for (const card of sample.report.cards) {
      assert.equal(typeof card.id, 'string')
      assert.equal(typeof card.title, 'string')
      assert.equal(typeof card.summary, 'string')
      assert.ok(Array.isArray(card.pages))
      assert.ok(Array.isArray(card.evidence))
      for (const page of card.pages) {
        assert.equal(typeof page.role, 'string')
        assert.equal(typeof page.label, 'string')
        assert.ok(page.text.length > 0, `${sample.id}/${card.id}: 空のページ本文があります`)
      }
    }
  }
})

test('PR-0b: 本文へ占術用語を出さない方針が守られている', () => {
  // evidence には残してよい。本文（pages/summary/title）にだけ出てはいけない。
  const forbidden = /天中殺|日柱|日主|干支|通変星|納音|命宮|夫妻宮|化禄|化忌|ナクシャトラ|アセンダント/
  for (const sample of samples) {
    for (const card of sample.report.cards) {
      const body = [card.title, card.summary, ...card.pages.map(page => page.text)].join('\n')
      assert.doesNotMatch(body, forbidden, `${sample.id}/${card.id}: 本文に占術用語が出ています`)
    }
  }
})

/**
 * ゴールデンスナップショット。
 * __snapshots__/selfReports.json が無ければスキップし、あれば完全一致を要求する。
 * 生成は `npm run snapshot:write`。
 */
test('PR-0b: ゴールデンスナップショットと完全一致する', { skip: !existsSync(snapshotPath) }, () => {
  const stored = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Record<string, unknown>
  for (const sample of samples) {
    assert.deepEqual(sample.report, stored[sample.id], `${sample.id}: スナップショットと差分があります`)
  }
  assert.equal(Object.keys(stored).length, samples.length, 'スナップショットの件数が一致しません')
})

/**
 * ベースライン指標。ここは「失敗させるための閾値」ではなく「記録するための出力」。
 * PR-1以降でこの値を締めていく。
 */
test('PR-0b: コーパス指標を記録する', () => {
  const corpus = measureCorpusQuality(samples)
  console.info('Self-report corpus metrics', corpus)
  for (const sample of samples.slice(0, 3)) {
    console.info('Self-report sample metrics', sample.id, measureReportQuality(sample.report, sample.findings))
  }
  // 最低限の健全性のみ検査する。数値の締め付けはPR-1以降。
  assert.equal(corpus.sampleCount, BIRTH_FIXTURES.length)
  assert.ok(corpus.distinctEssenceTitles > 0)
})
