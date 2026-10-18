import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { normalizeSukuyo } from '../keywordSignalMappings.js'
import { COMPATIBILITY_V24_IDENTITY } from './version.js'
type Section = {title:string;body:string;source_ids:string[];editorial_rule_ids:string[]}
type Bazi = {id:string;a:string;b:string;facts:{primary_branch:string;a_to_b_god:string;b_to_a_god:string};sections:Section[]}
type Sukuyo = {id:string;offset:number;family:string;a_sees_b:string;b_sees_a:string;distance:string|null;headlines:string[];bodies:string[];source_ids:string[]}
type Editorial = {cross:{branch:string;family:string;bridge_texts:string[]}[];endings:string[];reversal_bridges:{initiator_A_sukuyo_B:string[];initiator_B_sukuyo_A:string[];tension_then_ease_A:string;tension_then_ease_B:string}}
const load = <T>(name:string):T => {
  const bytes=readFileSync(new URL(`./data/${name}.json${name==='bazi'?'.gz':''}`,import.meta.url))
  return JSON.parse((name==='bazi'?gunzipSync(bytes):bytes).toString('utf8'))
}
// Indexed once per process. No full-text catalogue or per-request JSON parsing.
const pairs = new Map(load<Bazi[]>('bazi').map(b=>[`${b.a}|${b.b}`,b]))
const relations = new Map(load<Sukuyo[]>('sukuyo').map(t=>[t.id,t]))
const offsets = new Map([...relations.values()].map(t=>[t.offset,t]))
const editorial = load<Editorial>('editorial')
if(pairs.size!==3600 || relations.size!==27 || offsets.size!==27) throw new Error('Invalid compatibility v2.4 catalogue')
export const MANSIONS = '角 亢 氐 房 心 尾 箕 斗 女 虚 危 室 壁 奎 婁 胃 昴 畢 觜 参 井 鬼 柳 星 張 翼 軫'.split(' ')
export function relationForMansions(a:unknown,b:unknown):string {
  const ai=typeof a==='string'?MANSIONS.indexOf(normalizeSukuyo(a)):-1
  const bi=typeof b==='string'?MANSIONS.indexOf(normalizeSukuyo(b)):-1
  if(ai<0 || bi<0) throw new RangeError('相性鑑定の本命宿を確認してください')
  return offsets.get((bi-ai+27)%27)!.id
}
function reversal(b:Bazi,t:Sukuyo,k:number):string {
  const rb=editorial.reversal_bridges, f=b.facts
  if(!rb) return ''
  if(t.family==='安壊') {
    const initiator=f.a_to_b_god==='偏財' && f.b_to_a_god==='偏官'?'A':f.a_to_b_god==='偏官' && f.b_to_a_god==='偏財'?'B':null
    const active=t.a_sees_b==='安'?'A':'B'
    if(initiator==='A' && active==='B') return rb.initiator_A_sukuyo_B[k]
    if(initiator==='B' && active==='A') return rb.initiator_B_sukuyo_A[k]
  }
  if(k===1 && ['栄親','友衰'].includes(t.family)) {
    if(f.a_to_b_god==='偏官' && f.b_to_a_god==='偏財' && ['親','友'].includes(t.a_sees_b)) return rb.tension_then_ease_A
    if(f.a_to_b_god==='偏財' && f.b_to_a_god==='偏官' && ['栄','衰'].includes(t.a_sees_b)) return rb.tension_then_ease_B
  }
  return ''
}
// Python re \s includes U+001C–001F and U+0085, but excludes U+FEFF.
export const characterCount = (text:string) => Array.from(text.replace(/[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/gu,'')).length
export function composeCompatibility(a:unknown,b:unknown,relation:unknown) {
  if(typeof a!=='string' || typeof b!=='string' || typeof relation!=='string') throw new RangeError('相性鑑定の入力が不足しています')
  const ba=pairs.get(`${a}|${b}`),t=relations.get(relation)
  if(!ba || !t) throw new RangeError('相性鑑定の日柱または関係IDが不正です')
  const rule=editorial.cross.find(r=>r.branch===ba.facts.primary_branch && r.family===t.family)
  const sections=ba.sections.map((s,k)=>{
    const body=s.body+'\n\n'+(rule?.bridge_texts[k]??'')+reversal(ba,t,k)+t.bodies[k]+editorial.endings[k]
    return {title:s.title,headline:t.headlines[k],body,character_count:characterCount(body),source_ids:[...new Set([...s.source_ids,...t.source_ids])].sort(),editorial_rule_ids:[...s.editorial_rule_ids,t.id,`S_SECTION_${k}`]}
  })
  return {id:ba.id+'-'+t.id,day_a:ba.a,day_b:ba.b,sukuyo_relation_id:t.id,a_sees_b:t.a_sees_b,b_sees_a:t.b_sees_a,family:t.family,distance:t.distance,sections}
}
export function compatibilityKey(a:string,b:string,relation:string):string {
  return `${COMPATIBILITY_V24_IDENTITY}|${a}|${b}|${relation}`
}
