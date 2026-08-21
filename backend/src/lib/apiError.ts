import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'

export type ApiErrorCode =
  | 'AUTH_SESSION_INVALID'
  | 'SELF_READING_REQUIRED'
  | 'DEPENDENCY_NOT_READY'
  | 'GENERATION_TIMEOUT'
  | 'GENERATION_FAILED'
  | 'RATE_LIMITED'

export function correlationId(req: Request): string {
  const supplied = typeof req.header === 'function'
    ? req.header('X-Correlation-ID')
    : typeof req.headers?.['x-correlation-id'] === 'string' ? req.headers['x-correlation-id'] : undefined
  return supplied && /^[a-zA-Z0-9_-]{8,64}$/.test(supplied) ? supplied : randomUUID()
}

export function sendApiError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  error: string,
  retryable: boolean,
  requestId: string,
) {
  res.status(status).json({ code, error, retryable, correlationId: requestId })
}
