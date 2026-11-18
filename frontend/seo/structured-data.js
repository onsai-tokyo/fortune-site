// Only dates explicitly recorded in page metadata or the lastmod ledger belong
// in JSON-LD. A template date or a Git commit date is not a publication record.
export function recordedDate(value, field = 'date') {
  if (value == null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid recorded ${field}`)
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid recorded ${field}`)
  return value
}

export function structuredDates({ published, modified } = {}) {
  const datePublished = recordedDate(published, 'datePublished')
  const dateModified = recordedDate(modified, 'dateModified')
  return {
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
  }
}

// One hierarchy feeds both the visible breadcrumb and BreadcrumbList.
// Annual parents are included only after the parent page actually exists.
export function pageBreadcrumbs(page, { type = 'Article', origin, seriesHubs, availablePaths }) {
  const breadcrumbs = [{ name: 'Fate Lab', item: `${origin}/` }]
  if (type === 'Article') breadcrumbs.push({ name: '占い解説', item: `${origin}/guides/` })
  const annual = page.path.match(/^(guides\/(\d{4})-fortune)\//)
  const parents = annual
    ? [...seriesHubs, { path: annual[1], name: `${annual[2]}年の運勢` }]
    : seriesHubs
  const parent = parents.find(hub => page.path.startsWith(`${hub.path}/`) && availablePaths.has(hub.path))
  if (parent) breadcrumbs.push({ name: parent.name, item: `${origin}/${parent.path}` })
  breadcrumbs.push({ name: page.title, item: `${origin}/${page.path}` })
  return breadcrumbs
}
