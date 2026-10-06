export const AI_CONSENT_VERSION = 'anthropic-2026-10-07-v1'
export const AI_CONSENT_NOTICE = `AIへの情報送信について

送信先：Anthropic PBC（Claude API）
目的：相談・質問への回答や鑑定文章の作成。
送信する情報：入力した相談・質問・テーマ、鑑定文と計算結果、会話履歴、出生情報（生年月日・出生時刻・出生地・性別・ニックネームなど）。相手に関する情報や、本文に入力した個人情報も含まれる場合があります。共有してよい情報だけを入力してください。

プライバシーポリシー：https://fate-lab.com/privacy
同意は今回の送信に限ります。キャンセルしても保存済みの鑑定は読めます。

上記の情報をAnthropicへ送信することに同意しますか？`
export function needsAIConsent(url: string, method = 'GET'): boolean {
  if (method.toUpperCase() !== 'POST') return false
  const path = new URL(url, 'https://fate-lab.com').pathname.replace(/\/$/, '')
  return /^\/api\/(chat|fortune|analyze)(\/|$)/.test(path)
    || /^\/api\/report\/(generate|generate-pdf)$/.test(path)
    || path === '/api/preview/question' || path === '/api/books'
    || /^\/api\/reading\/conversations\/[^/]+\/questions$/.test(path)
}
export async function consentFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!needsAIConsent(url, init.method)) return fetch(url, init)
  if (!window.confirm(AI_CONSENT_NOTICE)) {
    return new Response(JSON.stringify({code:'AI_CONSENT_REQUIRED',error:'AIへ送信せずに戻りました。入力内容を確認してから再送できます。'}), {status:428, headers:{'Content-Type':'application/json'}})
  }
  const headers = new Headers(init.headers)
  headers.set('X-FateLab-AI-Consent', AI_CONSENT_VERSION)
  return fetch(url, {...init, headers})
}
