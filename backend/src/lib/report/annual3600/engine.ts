import { Solar } from 'lunar-javascript'
import { calcShichu, calcTenGod } from '../../divination/index.js'
import { resolveSpouseTimeZone } from '../personality/birthContext.js'
import { annualText, cycleIndex } from './catalog.js'
export interface AnnualContext {
  birthDate?: string; birthTime?: string; birthplace?: string; birthTimeZone?: string
  spouseConvention?: string; workContext?: string; annualYunConvention?: string
}
export type Truth = boolean | 'unknown'
export type LabelState = 'candidate' | 'not_selected' | 'needs_personal_context'
export const and = (...v: Truth[]): Truth => v.includes(false) ? false : v.includes('unknown') ? 'unknown' : true
export const or = (...v: Truth[]): Truth => v.includes(true) ? true : v.includes('unknown') ? 'unknown' : false
const stems = [...'甲乙丙丁戊己庚辛壬癸'], branches = [...'子丑寅卯辰巳午未申酉戌亥']
export const pillars = Array.from({ length: 60 }, (_, i) => stems[i % 10] + branches[i % 12])
const hidden: Record<string, string> = { 子:'癸',丑:'己癸辛',寅:'甲丙戊',卯:'乙',辰:'戊乙癸',巳:'丙戊庚',午:'丁己',未:'己丁乙',申:'庚壬戊',酉:'辛',戌:'戊辛丁',亥:'壬甲' }
const triples = ['申子辰','寅午戌','亥卯未','巳酉丑']
const combines = ['子丑','寅亥','卯戌','辰酉','巳申','午未'], clashes = ['子午','丑未','寅申','卯酉','辰戌','巳亥']
const stemCombines = ['甲己','乙庚','丙辛','丁壬','戊癸']
const matches = (table: string[], a: string, b: string) => table.includes(a + b) || table.includes(b + a)
const god = (day: string, stem: string) => calcTenGod(stems.indexOf(day), stems.indexOf(stem))
const cnInstant = (solar: { toYmdHms(): string }) => Date.parse(solar.toYmdHms().replace(' ', 'T') + '+08:00')
export const jst = (ms: number) => new Date(ms + 9 * 3600000).toISOString().replace('.000Z', '+09:00')
const boundaryCache = new Map<number, number>()
export function lichun(year: number): number {
  if (!Number.isInteger(year) || year < 1952 || year > 2101) throw new RangeError('Annual year outside supported calendar')
  if (!boundaryCache.has(year)) boundaryCache.set(year, cnInstant((Solar.fromYmdHms(year, 6, 1, 12, 0, 0).getLunar() as any).getJieQiTable()['立春']))
  return boundaryCache.get(year)!
}
export function solarYearAt(instant: number): number {
  const year = new Date(instant + 9 * 3600000).getUTCFullYear()
  return instant < lichun(year) ? year - 1 : year
}
export interface Decade { pillar: string; start: number; end: number }
export interface NatalContext { natal: Record<'year'|'month'|'day'|'hour', string | null>; decades: Decade[]; dayIndex: number }
/** JST midnight day boundary; CST solar terms; Yun sect 2. Missing time only
 * supplies invariant pillars across the civil day, never a precise decade start. */
export function natalContext(input: AnnualContext): NatalContext | null {
  if (resolveSpouseTimeZone(input) !== 'Asia/Tokyo' || !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate ?? '')) return null
  const [y,m,d] = input.birthDate!.split('-').map(Number), date = new Date(Date.UTC(y,m-1,d))
  if (y < 1952 || y > 2100 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m-1 || date.getUTCDate() !== d) return null
  const hasTime = typeof input.birthTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime)
  if (input.birthTime && !hasTime) return null
  const [h, min] = hasTime ? input.birthTime!.split(':').map(Number) : [0,0]
  const first = calcShichu(y,m,d,h,min), last = hasTime ? first : calcShichu(y,m,d,23,59)
  const natal = { year: first.year.kanshi === last.year.kanshi ? first.year.kanshi : null,
    month: first.month.kanshi === last.month.kanshi ? first.month.kanshi : null,
    day: first.day.kanshi, hour: hasTime ? first.hour?.kanshi ?? null : null }
  const decades: Decade[] = []
  if (hasTime && ['female','male'].includes(input.annualYunConvention ?? '')) {
    const c = new Date(Date.UTC(y,m-1,d,h-1,min))
    const solar = Solar.fromYmdHms(c.getUTCFullYear(),c.getUTCMonth()+1,c.getUTCDate(),c.getUTCHours(),c.getUTCMinutes(),0)
    // Runtime package exposes Yun; bundled declarations omit it.
    const yun = (solar.getLunar().getEightChar() as any).getYun(input.annualYunConvention === 'male' ? 1 : 0, 2)
    const start = yun.getStartSolar()
    yun.getDaYun(Math.ceil((2102-y)/10)+2).slice(1).forEach((p: any, i: number) => decades.push({pillar:p.getGanZhi(),start:cnInstant(start.nextYear(i*10)),end:cnInstant(start.nextYear((i+1)*10))}))
  }
  return { natal, decades, dayIndex: pillars.indexOf(natal.day) }
}
export interface AnnualLabel { kind: 'marriage'|'encounter'|'career'; state: LabelState; text: string }
export function evaluateLabels(n: NatalContext['natal'], annual: string, decade: string | null, input: AnnualContext) {
  const day = n.day
  if (!day) throw new Error('A day pillar is required')
  const layers = [...Object.values(n),decade]
  function touch(column: keyof typeof n): Truth {
    const target = n[column]
    if (!target) return 'unknown'
    if (annual[1] === target[1] || matches(combines,target[1],annual[1]) || matches(clashes,target[1],annual[1])) return true
    let uncertain = false
    for (const group of triples.filter(g => g.includes(target[1]) && g.includes(annual[1]))) {
      const present = (b: string) => layers.some(p => p?.[1] === b)
      if ([...group].every(present)) continue
      const completeWith = [...group].every(b => present(b) || annual[1] === b)
      if (layers.includes(null)) uncertain = true
      else if (completeWith) return true
    }
    return uncertain ? 'unknown' : false
  }
  const dayTouch = touch('day'), r1 = or(dayTouch, matches(stemCombines,day[0],annual[0]))
  const spouse = input.spouseConvention === 'female_officer' ? ['正官','偏官'] : input.spouseConvention === 'male_wealth' ? ['正財','偏財'] : null
  const visible = (p: string | null): Truth => !p || !spouse ? 'unknown' : spouse.includes(god(day[0],p[0]))
  const r2 = and(dayTouch, or(visible(annual), visible(decade)))
  const work: Truth[] = [touch('month')]
  for (const p of Object.values(n)) {
    if (!p) { work.push('unknown'); continue }
    if (!['正官','偏官','正印','偏印'].includes(god(day[0],p[0]))) continue
    work.push(annual[0] === p[0], matches(stemCombines,p[0],annual[0]))
    for (const [col, root] of Object.entries(n)) {
      if (!root) work.push('unknown')
      else if (hidden[root[1]].includes(p[0])) work.push(touch(col as keyof typeof n))
    }
  }
  const w1 = or(...work), peach = ['酉','卯','子','午'][triples.findIndex(g => g.includes(day[1]))] === annual[1]
  const social = peach || ['偏財','比肩','劫財','食神','傷官'].includes(god(day[0],annual[0]))
  const state = (v: Truth): LabelState => v === true ? 'candidate' : v === false ? 'not_selected' : 'needs_personal_context'
  const labels: AnnualLabel[] = [
    {kind:'marriage',state:state(r2),text:'婚期の候補'},
    {kind:'encounter',state:state(and(r1,social)),text:'出会いの機会'},
    {kind:'career',state:state(w1),text:input.workContext === 'student' ? '学び・進路の節目' : ['employed','independent'].includes(input.workContext ?? '') ? '仕事の転機候補' : '所属・活動の変化'},
  ]
  return { labels, rules: { R01:r1,R02:r2,W01:w1 } }
}
export function annualReading(input: AnnualContext, year: number, context = natalContext(input)) {
  if (!context || context.dayIndex < 0) return null
  const start = lichun(year), end = lichun(year+1)
  const bounds = [...new Set([start,end,...context.decades.flatMap(d => [d.start,d.end]).filter(t => t > start && t < end)])].sort((a,b)=>a-b)
  const segments = bounds.slice(0,-1).map((t,i) => {
    const decade = context.decades.find(d => d.start <= t && t < d.end)?.pillar ?? null
    return {start:jst(t),endExclusive:jst(bounds[i+1]),decade,...evaluateLabels(context.natal,pillars[cycleIndex(year)],decade,input)}
  })
  const labels = segments[0].labels.filter(l => l.state === 'candidate' && segments.every(s => s.labels.some(v => v.kind === l.kind && v.state === 'candidate')))
  return {year,start:jst(start),endExclusive:jst(end),text:annualText(context.dayIndex,year),labels,segments}
}
