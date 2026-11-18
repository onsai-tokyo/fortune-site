import fs from 'node:fs'
import path from 'node:path'

export function sitemapGroup(route) {
  if (/^uranai\//.test(route)) return 'uranai'
  if (/^guides\/\d{4}-fortune(?:\/|$)/.test(route)) return 'fortune'
  if (/^guides\/(day-master|ten-god|twelve-stage)\//.test(route)) return 'series'
  if (['', 'couple', 'coupons', 'tools/'].includes(route) || route.startsWith('tools/')) return 'tools'
  return 'guides'
}

export function writeSitemaps(dist, origin, pages) {
  const groups = new Map(['tools', 'guides', 'series', 'uranai', 'fortune'].map(name => [name, []]))
  for (const page of pages) groups.get(sitemapGroup(page.path)).push(page)
  const children = []
  for (const [name, entries] of groups) {
    // Future landing/annual pages get their own sitemap when they actually exist.
    if (!entries.length) continue
    const file = `sitemap-${name}.xml`
    const urls = entries.map(({ path: route, lastmod }) => `  <url><loc>${origin}/${route}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')
    fs.writeFileSync(path.join(dist, file), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
    children.push(file)
  }
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${children.map(file => `  <sitemap><loc>${origin}/${file}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`)
}
