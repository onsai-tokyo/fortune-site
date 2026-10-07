/** Log only an allowlist: provider errors can contain prompts or credentials. */
export function bookFailure(error: unknown) {
  const e = error as {status?:number;name?:string;message?:string;request_id?:string}
  const status = typeof e?.status === 'number' ? e.status : undefined
  const message = typeof e?.message === 'string' ? e.message : ''
  let code = 'BOOK_INTERNAL'
  let retryable = false, pause = false
  if (status===402 || /credit balance|billing|payment required|spend limit|usage limits|monthly spend/i.test(message)) { code='BOOK_PROVIDER_BILLING'; pause=true }
  else if (status===401 || status===403) { code='BOOK_PROVIDER_AUTH'; pause=true }
  else if (status===429) { code='BOOK_PROVIDER_LIMIT'; retryable=true }
  else if (status!==undefined && status>=500) { code='BOOK_PROVIDER_UNAVAILABLE'; retryable=true }
  else if (/Timeout|Connection/.test(e?.name??'')) { code='BOOK_PROVIDER_CONNECTION'; retryable=true }
  else if (/^BOOK_(DOCUMENT_[A-Z_]+|OUTPUT_SCHEMA|TRUNCATED|REPAIR_SCHEMA|REFUSED)$/.test(message)) {
    code=message; retryable=message!=='BOOK_REFUSED' && message!=='BOOK_DOCUMENT_POLICY'
  }
  const requestId = typeof e?.request_id==='string' && /^[a-zA-Z0-9_-]{1,120}$/.test(e.request_id) ? e.request_id : undefined
  return {code,retryable,pause,...(status===undefined?{}:{status}),...(requestId?{requestId}:{})}
}
export function bookRetryDelay(attempt:number) { return Math.min(120,30*2**Math.max(0,attempt-1)) }
