import ledger from '../../../seo/lastmod.json' with { type: 'json' }

// The same public page inventory is used by the build and the collection endpoint.
export const publicMeasurementPaths = Object.keys(ledger)
