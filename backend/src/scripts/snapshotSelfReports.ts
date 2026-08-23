import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { extractReportMetadata } from '../lib/report/metadata.js'
import { buildSelfReport, resolveSelfReportOptions, selfReportPipelineTag } from '../lib/report/buildSelfReport.js'
import { BIRTH_FIXTURES, buildFixtureReportInput } from '../lib/report/fixtures.js'
import { measureCorpusQuality, measureReportQuality, type CorpusSample } from '../lib/report/qualityMetrics.js'

/**
 * ゴールデンスナップショットとベースライン指標を書き出す。
 *
 *   npm run snapshot:write        現行経路のスナップショットを更新する
 *   npm run snapshot:metrics      指標だけを表示する（ファイルは書かない）
 *
 * 【運用ルール】
 * スナップショットの更新は「意図的に出力を変えたPR」でのみ行う。
 * テストが落ちたからという理由で更新してはならない。それをやると回帰検出が死ぬ。
 */

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const snapshotDir = resolve(backendRoot, 'src/lib/report/__snapshots__')
const snapshotPath = resolve(snapshotDir, 'selfReports.json')
const metricsPath = resolve(snapshotDir, 'baselineMetrics.json')

const writeMode = !process.argv.includes('--metrics-only')
const options = resolveSelfReportOptions()

const snapshot: Record<string, unknown> = {}
const samples: CorpusSample[] = []

for (const fixture of BIRTH_FIXTURES) {
  const input = buildFixtureReportInput(fixture)
  const metadata = extractReportMetadata(input)
  const result = buildSelfReport(input, metadata, options)
  snapshot[fixture.id] = result.report
  samples.push({ id: fixture.id, report: result.report, findings: result.findings })
}

const corpus = measureCorpusQuality(samples)
const perSample = samples.map(sample => ({
  id: sample.id,
  group: BIRTH_FIXTURES.find(fixture => fixture.id === sample.id)?.group,
  ...measureReportQuality(sample.report, sample.findings),
}))

const report = {
  generatedFor: selfReportPipelineTag(options),
  corpus,
  perSample,
}

console.log(`pipeline: ${report.generatedFor}`)
console.log('--- corpus ---')
console.table(corpus)
console.log('--- per sample ---')
console.table(perSample.map(item => ({
  id: item.id,
  group: item.group,
  chapters: item.chapterCount,
  supplement: item.supplementChapterRate,
  uniquePages: item.uniquePageTextRate,
  dupTitles: item.duplicateTitleCount,
  timing: item.timingCardCount,
  dupTiming: item.duplicateTimingTitleCount,
  systems: item.evidenceSystemCount,
  leakage: item.loveWorkLeakage,
})))

if (writeMode) {
  mkdirSync(snapshotDir, { recursive: true })
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  writeFileSync(metricsPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`\nwrote ${snapshotPath}`)
  console.log(`wrote ${metricsPath}`)
} else {
  console.log('\n--metrics-only: ファイルは書き込みませんでした')
}
