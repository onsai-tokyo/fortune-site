import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export function articleSentences(html) {
  const article = html.match(/<article>([\s\S]*?)<\/article>/)?.[1] ?? ''
  // Visible paragraphs, including calculation guidance and CTAs. Ignore headings,
  // menus, forms, scripts and metadata; punctuation/whitespace cannot create uniqueness.
  return [...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
    .flatMap(([, text]) => text.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity]).split(/[。！？!?]/))
    .map(text => text.normalize('NFKC').replace(/[\s、,]/g, ''))
    .filter(text => [...text].length >= 12)
}

export function seriesSentenceReport(dist) {
  const pages = ['day-master', 'ten-god', 'twelve-stage'].flatMap(group => fs.readdirSync(path.join(dist, 'guides', group), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({ route: `/guides/${group}/${entry.name}`, sentences: articleSentences(fs.readFileSync(path.join(dist, 'guides', group, entry.name, 'index.html'), 'utf8')) })))
  const owners = new Map()
  for (const { route, sentences } of pages) for (const sentence of new Set(sentences)) {
    if (!owners.has(sentence)) owners.set(sentence, new Set())
    owners.get(sentence).add(route)
  }
  return Object.fromEntries(pages.sort((a, b) => a.route.localeCompare(b.route)).map(({ route, sentences }) => {
    const duplicate = sentences.filter(sentence => owners.get(sentence).size > 1).length
    return [route, { sentences: sentences.length, duplicate, ratio: duplicate / sentences.length,
      fingerprint: createHash('sha256').update(sentences.join('\n')).digest('hex') }]
  }))
}
