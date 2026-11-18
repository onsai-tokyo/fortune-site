import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { recordedDate } from './structured-data.js'

export function japanDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function contentHash(html, bodySource = '') {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ''
  const description = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? ''
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => match[1])
  // Navigation, related links, timestamps, CSS and executable scripts are not article copy.
  const body = (html.match(/<article>([\s\S]*?)<\/article>/i)?.[1]
    ?? html.match(/<div id="root">([\s\S]*?)<\/div>/i)?.[1] ?? '')
    .replace(/<div class="meta">[\s\S]*?<\/div>/g, '')
    .replace(/<(script|style|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // A destination/wrapper change alone is a minor link edit, not a content revision.
    .replace(/<\/?a\b[^>]*>/gi, '')
  return createHash('sha256').update(JSON.stringify({ title, description, h1, body, bodySource })).digest('hex')
}

export function nextLastmod(previous, html, { initialLastmod = null, today = japanDate(), bodySource = '' } = {}) {
  const hash = contentHash(html, bodySource)
  const lastmod = previous?.hash
    ? (previous.hash === hash ? previous.lastmod : today)
    : (previous?.lastmod ?? initialLastmod)
  return { hash, lastmod }
}

export function applyLastmod(html, lastmod) {
  lastmod = recordedDate(lastmod, 'lastmod')
  const display = lastmod ?? '記録なし'
  return html
    .replace(/更新日：[^　<]+(?=　)/g, `更新日：${display}`)
    .replace(/<p>最終更新日：[^<]*<\/p>/g, `<p>最終更新日：${display}</p>`)
    .replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (tag, json) => {
      const data = JSON.parse(json)
      for (const entity of data['@graph'] ?? [data]) {
        if (!['Article', 'WebPage', 'WebApplication', 'CollectionPage'].includes(entity['@type'])) continue
        if (lastmod) entity.dateModified = lastmod
        else delete entity.dateModified
      }
      return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
    })
}

export function saveLastmod(file, entries) {
  const json = JSON.stringify(Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, 'en'))), null, 2) + '\n'
  fs.mkdirSync(new URL('.', file), { recursive: true })
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== json) fs.writeFileSync(file, json)
}
