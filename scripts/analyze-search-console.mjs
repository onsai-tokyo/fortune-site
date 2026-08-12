import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const COLUMN_NAMES = {
  query: ['query', 'queries', '検索キーワード', '検索クエリ', '上位のクエリ'],
  page: ['page', 'pages', 'ページ', '上位のページ'],
  clicks: ['clicks', 'クリック数'],
  impressions: ['impressions', '表示回数'],
  ctr: ['ctr', 'クリック率'],
  position: ['position', '平均掲載順位', '掲載順位'],
}

export function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1 } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(field); field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field); field = ''
      if (row.some(value => value.trim())) rows.push(row)
      row = []
    } else field += char
  }
  row.push(field)
  if (row.some(value => value.trim())) rows.push(row)
  return rows
}

function normalized(value) {
  return value.trim().toLowerCase().replaceAll(' ', '')
}

function findColumn(headers, key) {
  const candidates = COLUMN_NAMES[key].map(normalized)
  return headers.findIndex(header => candidates.includes(normalized(header)))
}

function number(value = '') {
  const cleaned = value.replaceAll(',', '').replace('%', '').trim()
  return Number(cleaned) || 0
}

export function normalizeRows(csvText) {
  const [headers = [], ...rows] = parseCsv(csvText.replace(/^\uFEFF/, ''))
  const columns = Object.fromEntries(Object.keys(COLUMN_NAMES).map(key => [key, findColumn(headers, key)]))
  for (const required of ['query', 'clicks', 'impressions', 'ctr', 'position']) {
    if (columns[required] < 0) throw new Error(`必須列「${COLUMN_NAMES[required].join(' / ')}」が見つかりません`)
  }
  return rows.map(values => ({
    query: values[columns.query]?.trim() || '',
    page: columns.page >= 0 ? values[columns.page]?.trim() || '' : '',
    clicks: number(values[columns.clicks]),
    impressions: number(values[columns.impressions]),
    ctr: number(values[columns.ctr]),
    position: number(values[columns.position]),
  })).filter(row => row.query && row.impressions > 0)
}

function expectedCtr(position) {
  if (position <= 1.5) return 20
  if (position <= 3) return 10
  if (position <= 5) return 5
  if (position <= 10) return 2.5
  return 1
}

export function classify(rows) {
  const opportunities = rows.filter(row => row.position >= 8 && row.position <= 30)
    .sort((a, b) => b.impressions - a.impressions || a.position - b.position)
  const lowCtr = rows.filter(row => row.position <= 10 && row.impressions >= 20 && row.ctr < expectedCtr(row.position) * .65)
    .sort((a, b) => b.impressions - a.impressions)
  const nearTop = rows.filter(row => row.position >= 4 && row.position < 8)
    .sort((a, b) => b.impressions - a.impressions)
  const winners = rows.filter(row => row.position <= 3 && row.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
  return { opportunities, lowCtr, nearTop, winners }
}

function table(rows, limit = 30) {
  if (!rows.length) return '_該当なし_\n'
  const lines = ['|検索語|ページ|クリック|表示|CTR|順位|', '|---|---|---:|---:|---:|---:|']
  for (const row of rows.slice(0, limit)) {
    const page = row.page ? row.page.replace('https://fate-lab.com', '') : '—'
    lines.push(`|${row.query.replaceAll('|', '｜')}|${page.replaceAll('|', '｜')}|${row.clicks}|${row.impressions}|${row.ctr}%|${row.position.toFixed(1)}|`)
  }
  return `${lines.join('\n')}\n`
}

export function renderReport(rows, sourceName = 'Search Console CSV') {
  const groups = classify(rows)
  const total = rows.reduce((sum, row) => sum + row.impressions, 0)
  return `# Fate Lab Search Console 改善候補\n\n` +
    `対象：${sourceName}  \n検索語数：${rows.length}  \n表示回数合計：${total}\n\n` +
    `## 1. 最優先：掲載順位8〜30位\n\n本文・見出し・内部リンクを検索意図へ合わせる候補です。\n\n${table(groups.opportunities)}\n` +
    `## 2. 高順位なのにCTRが低い\n\nタイトルとdescriptionを実際の検索語へ合わせる候補です。\n\n${table(groups.lowCtr)}\n` +
    `## 3. 4〜7位：上位3件を狙う\n\n具体例、比較表、一次情報を追加する候補です。\n\n${table(groups.nearTop)}\n` +
    `## 4. 維持する検索語\n\n順位を落とさないよう、大幅なURL・検索意図変更を避けます。\n\n${table(groups.winners)}\n` +
    `## 更新時の判断\n\n- 同じページに近い検索語が集まっていれば、一記事内の見出しとしてまとめる\n- 異なる検索意図が混ざっていれば、専用ページを作って相互リンクする\n- 表示回数が少ない語だけを理由に大量ページを作らない\n- 内容を変えず更新日だけを変更しない\n`
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const input = process.argv[2]
  if (!input) {
    console.error('使い方: node scripts/analyze-search-console.mjs <Search Console CSV> [出力Markdown]')
    process.exit(1)
  }
  const output = process.argv[3] || path.join('reports', `search-console-${new Date().toISOString().slice(0, 10)}.md`)
  const rows = normalizeRows(fs.readFileSync(input, 'utf8'))
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, renderReport(rows, path.basename(input)))
  console.log(`${rows.length}件を分析し、${output}へ保存しました`)
}
