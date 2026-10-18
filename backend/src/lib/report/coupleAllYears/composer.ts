import { makeTitle, type Signal, type TitleRules } from './title.js'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

export const PILLARS = Array.from({ length: 60 }, (_, i) => '甲乙丙丁戊己庚辛壬癸'[i % 10] + '子丑寅卯辰巳午未申酉戌亥'[i % 12])
export const MANSIONS = ['角','亢','氐','房','心','尾','箕','斗','女','虚','危','室','壁','奎','婁','胃','昴','畢','觜','参','井','鬼','柳','星','張','翼','軫']
const PHASES = [...MANSIONS.slice(0, 8), '斗', ...MANSIONS.slice(8)]
const HOST_ORDER = ['昴','畢','觜','参','井','鬼','柳','星','張','翼','軫','角','亢','氐','房','心','尾','箕','斗','女','虚','危','室','壁','奎','婁','胃']
const FILES = ['annual_facts_3600','pair_facts_3600','bazi_theme_rules','bazi_interactions_25','sukuyo_relation_offsets','sukuyo_year_role_rules','editorial_fragments','fixed_pair_modifiers','natal_sukuyo_profiles_reference','title_fragments','body_expression_overrides','age_fragments','age_context'] as const
export const BANDS = ['infant','preschool','child','teen','adult'] as const
type Band = typeof BANDS[number]
type Cell = {theme:string;action:string;difficulty:string;title:{link:string;end:string}}
type AgeFragments = {version:string;bazi:Record<Band,Record<string,Cell>>;sukuyo:Record<Band,Record<string,Cell>>;effects:Record<Band,Record<string,Cell>>}
type AgeContext = {profiles:Record<Band,Record<string,string>>;bazi_hints:Record<Band,Record<string,string>>;sukuyo_hints:Record<Band,Record<string,string>>;pair_bazi:Record<Band,Record<string,string>>;pair_sukuyo:Record<Band,Record<string,string>>;bridge:Record<string,string>;recipient_overrides:Record<string,string>}
type Facts = Record<string, unknown> & { year_stem_god: string; year_branch_main_god: string }
type Rule = { group: string; theme: string; friction: string }
type Editorial = { version: string; effect_order: string[]; bazi_actions: Record<string,string>; effect_sentences: Record<string,string>; bazi_difficulties: Record<string,string>; bazi_hints: Record<string,string>; sukuyo_actions: Record<string,string>; sukuyo_hints: Record<string,string> }
type Relation = { id: string; family: string; a_sees_b: string }
function read<T>(name: string): T { return JSON.parse(gunzipSync(readFileSync(new URL(`./data/${name}.json.gz`, import.meta.url))).toString('utf8')) as T }
function load() {
  const profiles = read<Array<{cell_id:string; blocks:{conclusion:{text:string}}}>>('natal_sukuyo_profiles_reference')
  const hash = createHash('sha256')
  for (const f of FILES) hash.update(f).update(gunzipSync(readFileSync(new URL(`./data/${f}.json.gz`, import.meta.url))))
  return {
    age:read<AgeFragments>('age_fragments'), context:read<AgeContext>('age_context'),
    title: read<TitleRules>('title_fragments'), body: read<{role_difficulties:Record<string,string>}>('body_expression_overrides'),
    annual: read<Record<string,{facts:Facts}>>('annual_facts_3600'),
    pairs: read<Record<string,{facts:{primary_branch:string}}>>('pair_facts_3600'),
    bt: read<Record<string,Rule>>('bazi_theme_rules'), bi: read<Record<string,{theme:string}>>('bazi_interactions_25'),
    relations: read<Relation[]>('sukuyo_relation_offsets'), sy: read<Record<string,Rule>>('sukuyo_year_role_rules'),
    e: read<Editorial>('editorial_fragments'), mod: read<{bazi:Record<string,string>;sukuyo:Record<string,string>}>('fixed_pair_modifiers'),
    profiles: new Map(profiles.map(p => [p.cell_id, p.blocks.conclusion.text])), hash: hash.digest('hex').slice(0,16),
  }
}
let loaded: ReturnType<typeof load> | undefined
const data = () => loaded ??= load()
const mod = (n:number, d:number) => ((n % d) + d) % d
const num = (n:number) => String(n).padStart(2,'0')
const plain = (text:string) => text.replaceAll('・','ことや')
const truthy = (value:unknown) => Array.isArray(value) ? value.length > 0 : Boolean(value)
const chars = (parts:string[]) => parts.reduce((n,s) => n + [...s].length,0)
function pillar(value:unknown): string {
  if (typeof value !== 'string' || !PILLARS.includes(value)) throw new Error('INVALID_DAY_PILLAR')
  return value
}
export function mansion(value:unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_MANSION')
  const name = value.replace(/宿$/, '')
  if (!MANSIONS.includes(name)) throw new Error('INVALID_MANSION')
  return name
}
export function calendarLabel(year:number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('UNSUPPORTED_YEAR')
  const phase = mod(7 + year - 2009,28)
  return { year_label:year, bazi_year_pillar:PILLARS[mod(year-1984,60)], sukuyo_phase_index:phase, sukuyo_year_mansion:PHASES[phase], calendar_method:'koseido_28_phase_candidate', date_boundary_resolved:false }
}
export function identity() { const d=data(); return `all-years-composer-0.3-age|grounded-title-age-1.0|${d.hash}|koseido_28_phase_candidate|boundaries-unresolved` }

export function ageContext(year:number,birthYear:unknown) {
  if(!Number.isInteger(year)||typeof birthYear!=='number'||!Number.isInteger(birthYear)||birthYear<1||birthYear>year||year>9999) throw new Error('BIRTH_YEAR_REQUIRED_OR_INVALID')
  const age=year-birthYear,band:Band=age<=2?'infant':age<=5?'preschool':age<=12?'child':age<=17?'teen':'adult'
  return {birth_year:birthYear,age_reached:age,band,rule:'target_year - birth_year',policy_version:'age-editorial-1.0'}
}
export function baziPart(aInput:unknown,bInput:unknown,yearInput:unknown) {
  const [a,b,year]=[aInput,bInput,yearInput].map(pillar),[ia,ib,iy]=[a,b,year].map(v=>PILLARS.indexOf(v)+1)
  const refs=[`P${num(ia)}-Y${num(iy)}`,`P${num(ib)}-Y${num(iy)}`]
  return {schema_version:'materials-2.0',id:`PY-B-${num(ia)}-${num(ib)}-${num(iy)}`,pair_ref:`BZ-${num(ia)}-${num(ib)}`,actors:[a,b].map((day_pillar,i)=>({actor:['A','B'][i],day_pillar,annual_reference:refs[i],facts_ref:refs[i]}))}
}
export function sukuyoPart(aInput:unknown,bInput:unknown,yearInput:unknown) {
  const [a,b,year]=[aInput,bInput,yearInput].map(mansion),[ia,ib,iy]=[a,b,year].map(v=>MANSIONS.indexOf(v)),d=data(),rel=d.relations[mod(ib-ia,27)]
  return {schema_version:'materials-2.0',id:`PY-S-${num(ia+1)}-${num(ib+1)}-${num(iy+1)}`,pair_ref:rel.id,pair_family:rel.family,actors:[a,b].map((m,i)=>({actor:['A','B'][i],mansion:m,year_role:d.relations[mod([ia,ib][i]-iy,27)].a_sees_b,profile_ref:`SYR${num(HOST_ORDER.indexOf(m)+1)}-07`}))}
}
export function composeYear(a:unknown,b:unknown,sa:unknown,sb:unknown,year:number,birthYearA?:number,birthYearB?:number) {
  const ages=[ageContext(year,birthYearA),ageContext(year,birthYearB)],calendar=calendarLabel(year),d=data(),ctx=d.context
  const bp=baziPart(a,b,calendar.bazi_year_pillar),sp=sukuyoPart(sa,sb,calendar.sukuyo_year_mansion)
  const facts=bp.actors.map(r=>d.annual[r.annual_reference].facts),bands=ages.map(v=>v.band)
  const pairBand=BANDS[Math.min(...bands.map(v=>BANDS.indexOf(v)))]
  const gods=facts.map(f=>f.year_stem_god),roles=sp.actors.map(r=>r.year_role)
  const bz=bands.map((band,i)=>d.age.bazi[band][gods[i]]),sy=bands.map((band,i)=>d.age.sukuyo[band][roles[i]])
  const fmt=(s:string,i:number)=>s.replaceAll('{other}',i===0?'相手':'あなた')
  const opening=(cells:Cell[],prefix:string)=>prefix+(cells[0].theme===cells[1].theme?'二人とも'+cells[0].theme+'がテーマです。':'あなたは'+cells[0].theme+'、相手は'+cells[1].theme+'がテーマです。')
  const mainOpen=opening(bz,'この年、'),syOpen=opening(sy,'こうした動きを気持ちの面から見ると、')
  const actions=bz.map((cell,i)=>fmt(bands[i]==='adult'&&gods[i]==='印綬'&&['infant','preschool'].includes(bands[1-i])?ctx.recipient_overrides['adult_to_'+bands[1-i]+'_learning']:cell.action,i))
  const p1=mainOpen+'あなたが'+actions[0]+'可能性があります。また、相手が'+actions[1]+'形で表れることもあります。'+ctx.bridge[pairBand==='adult'?'adult':'minor']
  const signals:Signal[]=[],effects:string[]=[],secondary:Array<{text:string;signal:Signal}>=[]
  const signal=(i:number,source:Signal['source'],value:string,index:number,text:string,reference:string,cell:Cell):Signal=>({actor:i===0?'A':'B',source,value,age_band:bands[i],paragraph_index:index,evidence_text:text,reference,title_fragment:cell.title})
  for(let i=0;i<2;i++) {
    const name=i===0?'あなた':'相手',f=facts[i],ref=bp.actors[i].annual_reference
    signals.push(signal(i,'bazi_main',gods[i],0,mainOpen,ref,bz[i]))
    const k=d.e.effect_order.find(key=>truthy(f[key]))
    if(k){const cell=d.age.effects[bands[i]][k],text=name+'側では、'+cell.theme+(['infant','preschool','child'].includes(bands[i])?'がテーマになります。':'');effects.push(text);signals.push(signal(i,'bazi_effect',k,1,text,ref,cell))}
    if(f.year_branch_main_god!==gods[i]){const cell=d.age.bazi[bands[i]][f.year_branch_main_god],text=name+'には、'+cell.theme+'も大切な観点です。';secondary.push({text,signal:signal(i,'bazi_secondary',f.year_branch_main_god,1,text,ref,cell)})}
    signals.push(signal(i,'sukuyo_role',roles[i],2,syOpen,sp.id,sy[i]))
  }
  let p2=effects.join('')+'一方、あなたは'+fmt(bz[0].difficulty,0)+'ことがあり、相手は'+fmt(bz[1].difficulty,1)+'ことがあります。'+ctx.bazi_hints[pairBand][d.bt[gods[0]].group]
  let p3=syOpen+'あなたが'+fmt(sy[0].action,0)+'可能性があります。また、相手が'+fmt(sy[1].action,1)+'可能性もあります。'
  for(let i=0;i<2;i++){const name=i===0?'あなた':'相手',trait=ctx.profiles[bands[i]][sp.actors[i].mansion];p3+=bands[i]==='adult'?name+'は、'+trait:name+'の関わり方では、'+trait+'が手がかりになります。'}
  const difficulties=sy.map((cell,i)=>['teen','adult'].includes(bands[i])&&roles[i]==='親'&&['infant','preschool'].includes(bands[1-i])?'自分の働きかけに、同じ強さの反応が返ることを期待する':fmt(cell.difficulty,i))
  const p4='あなたは'+difficulties[0]+'ことがあり、相手は'+difficulties[1]+'ことがあります。'+ctx.sukuyo_hints[pairBand][d.sy[roles[0]].group]+ctx.pair_sukuyo[pairBand][sp.pair_family]
  const paragraphs=[p1,p2,p3,p4],optional=secondary.map(s=>s.text).join(''),pairText=ctx.pair_bazi[pairBand][d.pairs[bp.pair_ref].facts.primary_branch]??''
  if(chars(paragraphs)+[...optional].length<=1000){paragraphs[1]=optional+paragraphs[1];signals.push(...secondary.map(s=>s.signal))}
  if(chars(paragraphs)+[...pairText].length<=1000)paragraphs[1]+=pairText
  const n=chars(paragraphs)
  if(n<500||n>1000||signals.some(s=>!paragraphs[s.paragraph_index].includes(s.evidence_text)))throw new Error('BODY_CONTRACT_FAILED')
  const title=makeTitle(signals,{A:[bp.actors[0].day_pillar,sp.actors[0].mansion,String(birthYearA)],B:[bp.actors[1].day_pillar,sp.actors[1].mansion,String(birthYearB)]},d.title)
  const cachePayload={composer:'all-years-composer-0.3-age',age_policy:d.age.version,title_version:title.version,year,bazi_key:bp.id,sukuyo_key:sp.id,birth_years:[birthYearA,birthYearB]}
  const sorted=Object.fromEntries(Object.entries(cachePayload).sort(([a],[b])=>a<b?-1:a>b?1:0))
  return {title:title.text,title_basis:title,paragraphs,character_count:n,year,bazi_key:bp.id,sukuyo_key:sp.id,version:cachePayload.composer,ages:{A:ages[0],B:ages[1]},cache_identity:cachePayload,cache_key:createHash('sha256').update(JSON.stringify(sorted)).digest('hex'),audit:{bazi:bp,sukuyo:sp},probability:null,calendar}
}
