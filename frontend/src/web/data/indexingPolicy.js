export const indexRobots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
export const privateRobots = 'noindex,nofollow'
const publicAppPaths = new Set(['/', '/couple', '/coupons', '/support', '/terms', '/privacy', '/tokushoho', '/tokushohou', '/threads-launch', '/contact', ...readingFocusPaths])

// These routes must also return noindex before any JavaScript runs.
export const privateAppRouteSources = [
  ...['restore', 'legacy', 'reading', 'r', 's', 'login', 'welcome', 'creating', 'you', 'compose', 'books', 'credits', 'settings', 'sales-conditions', 'app-legal', 'demo'].map(prefix => `/${prefix}/:path*`),
  '/couple/:partnerId', '/app.html',
]

export function appRobots(pathname) {
  return publicAppPaths.has(pathname.replace(/\/$/, '') || '/') ? indexRobots : privateRobots
}

export function updateAppRobots(document, pathname) {
  const meta = document.querySelector('meta[name="robots"]') ?? document.createElement('meta')
  meta.name = 'robots'
  meta.content = appRobots(pathname)
  if (!meta.isConnected) document.head.appendChild(meta)
}
import { readingFocusPaths } from './readingFocus.js'
