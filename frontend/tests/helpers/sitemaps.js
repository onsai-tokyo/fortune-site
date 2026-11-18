import fs from 'node:fs'

export function sitemapRoutes(dist) {
  const index = fs.readFileSync(new URL('sitemap.xml', dist), 'utf8')
  const documents = index.includes('<sitemapindex')
    ? [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => fs.readFileSync(new URL(new URL(url).pathname.slice(1), dist), 'utf8'))
    : [index]
  return documents.flatMap(xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url).pathname))
}
