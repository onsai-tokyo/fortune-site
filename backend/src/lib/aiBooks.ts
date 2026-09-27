import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library'
import { getSupabaseAdmin } from './supabaseAdmin.js'
import { storedReportFromCalculatedData } from './report/storedReport.js'
import { type ReportCard } from './reportCards.js'

export const BOOK_PRODUCT = 'com.onsai.fatelab.report.single'
export const BOOK_PROMPT_VERSION = 'consultation-book-20260928.4'
export const BOOK_THEMES = ['恋愛・関係', '仕事', '人間関係', '時期の判断', 'その他']
export const uuidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
export class BookError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message) }
}
export interface BookSource { id: string; title: string; text: string; version: string; evidence: unknown[] }
export interface BookDocument {
  title: string; summary: string; answer: string; conclusion?: string; highlights?: string[];
  sections: Array<{ heading: string; body: string; sourceId: string; quote: string }>;
  actions: string[];
}
// This is a first-pass editorial boundary, not a claim that keyword checks classify all risks.
export function validateBookQuestion(question: unknown, theme: unknown): string {
  if (typeof question !== 'string' || [...question.trim()].length < 20 || [...question.trim()].length > 400 || !BOOK_THEMES.includes(String(theme)))
    throw new BookError('BOOK_INPUT', 422, 'テーマを選び、相談を20〜400文字で入力してください。')
  const q = question.normalize('NFKC')
  if (/自殺|自傷|死にたい|消えたい|命を絶|生きていたくない/.test(q))
    throw new BookError('BOOK_SUPPORT', 422, 'この内容は鑑定書では扱えません。今すぐ危険がある場合は119・110へ連絡し、身近な人や医療機関に相談してください。')
  if (/寿命|余命|死ぬ|亡くなる|妊娠|不妊|病気|診断|癌|がん|服薬|薬を|治療|訴訟|裁判|法律判断|投資|株価|銘柄|殺す|傷つける方法|監視|ストーキング/.test(q))
    throw new BookError('BOOK_POLICY', 422, '健康・妊娠・生死、法律や投資の判断、他者への加害や監視は扱えません。気持ちの整理や人との接し方について相談してください。')
  return question.trim()
}
export function bookSources(row: { kind?: string; report_text?: string; calculated_data?: unknown }, theme: string): BookSource[] {
  const report = storedReportFromCalculatedData(row.calculated_data)
  if (!report || report.generator !== 'deterministic' || !report.generatorVersion) return []
  const scope = row.kind === 'compatibility' ? 'couple' : 'self'
  const cards = report.cards.filter(c => c.generator !== 'ai' && c.kind !== 'chart' && c.tab !== 'chart' && (!c.scope || c.scope === scope))
  const relevance = (c: ReportCard) => {
    const text = c.title + c.summary + c.tags.join(' ')
    const pattern = theme === '仕事' ? /仕事|職|働|役割/ : theme === '恋愛・関係' ? /恋|愛|関係|ふたり|結婚/ : theme === '時期の判断' ? /年|時期|流れ/ : /性格|軸|人|関係/
    return (pattern.test(text) ? 2 : 0) + (c.kind === 'essence' ? 1 : 0)
  }
  const seen = new Set<string>()
  return cards.sort((a,b) => relevance(b)-relevance(a)).filter(c => !seen.has(c.id) && !!seen.add(c.id)).slice(0,12).map(c => ({
    id: c.id, title: c.title, text: [c.summary, ...(c.sections?.map(s => s.heading+'\n'+s.body) ?? c.pages.map(p => p.text))].join('\n').slice(0,6500),
    version: report.generatorVersion ?? `structured-v${report.version}`, evidence: c.evidence,
  }))
}
function bounded(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && [...value.trim()].length >= min && [...value].length <= max
}
export function validateBookDocument(value: unknown, sources: BookSource[]): BookDocument {
  const d = value as BookDocument
  if (!d || !bounded(d.title,4,60) || !bounded(d.summary,20,500) || !bounded(d.answer,100,2000)
      || !Array.isArray(d.sections) || d.sections.length<3 || d.sections.length>5
      || !Array.isArray(d.actions) || d.actions.length<2 || d.actions.length>3 || !d.actions.every(a=>bounded(a,15,300))) throw new Error('BOOK_DOCUMENT_SCHEMA')
  const ids = new Set<string>()
  for (const s of d.sections) {
    const source = sources.find(c=>c.id===s.sourceId)
    if (!source || ids.has(s.sourceId) || !bounded(s.heading,2,60) || !bounded(s.body,50,1200)
        || !bounded(s.quote,10,300) || !source.text.includes(s.quote)) throw new Error('BOOK_DOCUMENT_EVIDENCE')
    ids.add(s.sourceId)
  }
  const length = [...[d.summary, d.answer, ...d.sections.map(s=>s.body), ...d.actions].join('')].length
  if (length < 4500 || length > 6000) throw new Error('BOOK_DOCUMENT_LENGTH')
  const text = JSON.stringify(d)
  if (/必ず.{0,20}(なる|する|できる|起きる)|絶対に|確実に.{0,20}(なる|する|起きる)|寿命|余命|妊娠して|癌|病気が治|株価が|死ぬ/.test(text)) throw new Error('BOOK_DOCUMENT_POLICY')
  if(d.conclusion!==undefined && !bounded(d.conclusion,40,300)) throw new Error('BOOK_DOCUMENT_CONCLUSION')
  const bodies=[d.answer,...d.sections.map(s=>s.body),...d.actions]
  if(d.highlights!==undefined && (!Array.isArray(d.highlights) || d.highlights.length>8 || !d.highlights.every(h=>bounded(h,8,100) && bodies.some(t=>t.includes(h))))) throw new Error('BOOK_DOCUMENT_HIGHLIGHTS')
  // Strip unrecognized model fields before persistence or UI delivery.
  return { title:d.title, summary:d.summary, answer:d.answer, ...(d.conclusion?{conclusion:d.conclusion}:{}), ...(d.highlights?{highlights:d.highlights}:{}), actions:d.actions, sections:d.sections.map(s=>({heading:s.heading,body:s.body,sourceId:s.sourceId,quote:s.quote})) }
}
export async function bookRPC(name: string, args: Record<string, unknown> = {}) {
  const {data,error} = await getSupabaseAdmin().rpc(name,args)
  if (error) {
    if (error.message?.includes('BOOK_NO_CREDITS')) throw new BookError('BOOK_NO_CREDITS',409,'鑑定書の利用枠がありません。会員特典または単品購入をご利用ください。')
    if (error.message?.includes('BOOK_OPERATION_CONFLICT')) throw new BookError('BOOK_OPERATION_CONFLICT',409,'受付済みの相談と内容が異なります。本棚から受付状況をご確認ください。')
    throw new BookError('BOOK_UNAVAILABLE',503,'鑑定書の処理を確認できませんでした。再購入せず、もう一度お試しください。')
  }
  return data
}
export async function grantVerifiedBookPurchase(tx: JWSTransactionDecodedPayload, requestUser?: string) {
  const validTime = (n: unknown): n is number => typeof n==='number' && Number.isSafeInteger(n) && n>0 && n<253402300799999
  if (tx.productId!==BOOK_PRODUCT || tx.type!=='Consumable' || !tx.appAccountToken || !uuidPattern.test(tx.appAccountToken)
      || !tx.transactionId || !['Sandbox','Production'].includes(tx.environment ?? '') || !validTime(tx.purchaseDate)
      || !validTime(tx.signedDate) || (tx.revocationDate!==undefined && !validTime(tx.revocationDate))
      || (requestUser && requestUser.toLowerCase()!==tx.appAccountToken.toLowerCase()))
    throw new BookError('BOOK_PURCHASE_INVALID',400,'購入情報の所有者または商品を確認できませんでした。')
  await bookRPC('ai_book_grant',{p_user:tx.appAccountToken.toLowerCase(),p_environment:tx.environment,p_transaction:tx.transactionId,
    p_source:'purchase',p_start:new Date(tx.purchaseDate).toISOString(),p_end:null,p_revoked:tx.revocationDate!==undefined,p_signed:tx.signedDate})
  return {verified:true,delivery:'mirrored',transactionId:tx.transactionId,ownerId:tx.appAccountToken.toLowerCase()}
}
