import type { RequestHandler } from 'express'

export function apiMaintenanceEnabled() {
  return process.env.FATELAB_API_MAINTENANCE === 'true'
}

/** Explicit operator switch for the coordinated schema/writer cutover. Off by default. */
export function apiMaintenanceGate(enabled = apiMaintenanceEnabled): RequestHandler {
  return (_req, res, next) => {
    if (!enabled()) { next(); return }
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Retry-After', '60')
    res.status(503).json({code:'MAINTENANCE_MODE',retryable:true,error:'更新作業中です。少し待ってから再試行してください。'})
  }
}
