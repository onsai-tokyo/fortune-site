import { astro as iztro } from 'iztro'
import { Solar } from 'lunar-javascript'
import { calcAstrology } from '../astrology.js'
import { Astronomy } from '../astronomyEngineAdapter.js'
import { calcShichu, calcSanmei } from '../divination/index.js'
import { assertFateLabZiweiConfig, timeIndex } from '../ziwei.js'
import { readingVimshottariInterval } from './readingVimshottari.js'

export interface ReadingSignBirth { birthDate?: string; birthTime?: string; birthplace?: string; gender?: string }
export interface ReadingSignFact { key: string; lineage: string; days: string[] }
const SIGNS = ['牡羊座','牡牛座','双子座','蟹座','獅子座','乙女座','天秤座','蠍座','射手座','山羊座','水瓶座','魚座']
const RULERS = ['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter']
const BODIES = { 木星:Astronomy.Body.Jupiter,土星:Astronomy.Body.Saturn,天王星:Astronomy.Body.Uranus,海王星:Astronomy.Body.Neptune,冥王星:Astronomy.Body.Pluto }
const PERSONAL = { 太陽:Astronomy.Body.Sun,水星:Astronomy.Body.Mercury,金星:Astronomy.Body.Venus,火星:Astronomy.Body.Mars }
const DAY=86_400_000,JST=9*3_600_000
const longitude=(body:Parameters<typeof Astronomy.GeoVector>[0],date:Date)=>Astronomy.Ecliptic(Astronomy.GeoVector(body,date,true)).elon
const distance=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180)
const pair=(a:string,b:string,pairs:string[])=>pairs.some(p=>p.includes(a)&&p.includes(b)&&a!==b)

/** Public ephemeris/calendar only: no birth data or person-specific results in this bounded cache. */
const calendarCache=new Map<number,Array<{day:string;lunarYear:number;chart:{year:{branch:string};month:{branch:string}};transits:Record<string,number>}>>()
function calendar(year:number){
  const cached=calendarCache.get(year);if(cached)return cached
  const rows=[]
  for(let t=Date.UTC(year,0,1);t<Date.UTC(year+1,0,1);t+=DAY){
    const d=new Date(t),day=d.toISOString().slice(0,10),noon=new Date(`${day}T12:00:00+09:00`)
    // Same JST-noon -> CST-11:00 solar-term convention as calcShichu.
    // Only year/month pillars are needed; do not compute natal day/hour and jieDays repeatedly.
    const lunar=Solar.fromYmdHms(year,d.getUTCMonth()+1,d.getUTCDate(),11,0,0).getLunar()
    rows.push({day,lunarYear:(lunar as unknown as {getYear():number}).getYear(),chart:{year:{branch:lunar.getYearInGanZhiExact()[1]},month:{branch:lunar.getMonthInGanZhiExact()[1]}},transits:Object.fromEntries(Object.entries(BODIES).map(([name,body])=>[name,longitude(body,noon)]))})
  }
  if(calendarCache.size>=64)calendarCache.delete(calendarCache.keys().next().value!)
  calendarCache.set(year,rows);return rows
}

/** Collect only registered signs. No scores, cohort labels or Timing V2 dependency. */
export function annualSignFacts(birth:ReadingSignBirth,years:readonly number[],keys:readonly string[]):Map<number,ReadingSignFact[]> {
  const output=new Map<number,ReadingSignFact[]>()
  if(!birth.birthDate||!/^\d{4}-\d{2}-\d{2}$/.test(birth.birthDate)||!['male','female'].includes(birth.gender??''))return output
  const [y,m,d]=birth.birthDate.split('-').map(Number)
  if(y<1900||y>new Date().getUTCFullYear()||!Number.isFinite(Date.parse(birth.birthDate))||new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==birth.birthDate)return output
  if(birth.birthTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(birth.birthTime))return output
  const [h,minute]=birth.birthTime?birth.birthTime.split(':').map(Number):[undefined,0]
  const known=h!==undefined,natal=calcShichu(y,m,d,h,minute),chart=calcAstrology(y,m,d,h,minute,birth.birthplace)
  const stableDay=known||[0,23].every(hour=>calcShichu(y,m,d,hour,59).day.kanshi===natal.day.kanshi)
  const voids=calcSanmei(natal.day.stemIdx,natal.day.branchIdx,natal.month.branchIdx,natal.jieDays).chusatsu.slice(0,2)
  const instant=known?new Date(Date.UTC(y,m-1,d,h!-9,minute)):null
  const asc=chart.vedic?.ascendant,ascIndex=asc?SIGNS.indexOf(asc.sign):-1
  const stableHouses=!!instant&&ascIndex>=0&&[-5,5].every(delta=>{
    const t=new Date(instant.getTime()+JST+delta*60_000)
    return calcAstrology(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate(),t.getUTCHours(),t.getUTCMinutes(),birth.birthplace).vedic?.ascendant?.sign===asc!.sign
  })
  const natalSets=known?[chart.western?.planets??[]]:Array.from({length:24},(_,hour)=>Object.entries(PERSONAL).map(([name,body])=>({name,longitude:longitude(body,new Date(Date.UTC(y,m-1,d,hour-9)))})))
  const angleValues:Record<string,number>={}
  for(const [name,angle]of [['ASC',chart.western?.ascendant],['MC',chart.western?.midheaven]] as const)if(angle)angleValues[name]=SIGNS.indexOf(angle.sign)*30+angle.degree
  assertFateLabZiweiConfig()
  const ziwei=known?iztro.bySolar(birth.birthDate,timeIndex(h!),birth.gender as 'male'|'female',true,'ja-JP'):null
  // horoscopeDivide=normal is asserted above: yearly index/mutagens change at lunar new year.
  // Cache only within this birth calculation; do not retain a person's chart globally.
  const ziweiYears=new Map<number,NonNullable<typeof ziwei>['horoscope'] extends (...args:any[])=>infer R?R extends {yearly:infer Y}?Y:never:never>()
  const wanted=new Set(keys),westernKeys=keys.filter(k=>k.startsWith('western:'))
  for(const year of [...new Set(years)].filter(year=>Number.isInteger(year)&&year>y&&year<y+119)){
    const facts=new Map<string,ReadingSignFact>()
    const add=(key:string,day:string,lineage=key)=>{if(!wanted.has(key))return;const id=key+'|'+lineage,old=facts.get(id);if(old)old.days.push(day);else facts.set(id,{key,lineage,days:[day]})}
    const periods=stableHouses?readingVimshottariInterval({birthInstant:instant!.toISOString(),siderealMoonLongitude:chart.vedic!.planets.find(p=>p.name==='月')!.longitude,sourceRef:'calcAstrology approximate Lahiri',from:`${year}-01-01T00:00:00+09:00`,until:`${year+1}-01-01T00:00:00+09:00`}).periods:[]
    for(const row of calendar(year)){
      const {day}=row,noon=Date.parse(`${day}T12:00:00+09:00`)
      if(stableDay)for(const scope of ['year','month'] as const){
        const pillar=row.chart[scope],branch=natal.day.branch
        if(pair(branch,pillar.branch,['子午','丑未','寅申','卯酉','辰戌','巳亥']))add(`calendar:${scope}:冲`,day)
        if(pair(branch,pillar.branch,['子丑','寅亥','卯戌','辰酉','巳申','午未']))add(`calendar:${scope}:六合`,day)
        if(voids.includes(pillar.branch))add(`sanmei:${scope}:chusatsu`,day)
      }
      for(const key of westernKeys){
        const [,transit,name,angle]=key.split(':'),degrees=Number(angle),lon=row.transits[transit]
        const values=name in angleValues?[angleValues[name]]:natalSets.map(set=>set.find(p=>p.name===name)?.longitude)
        if(lon===undefined||values.some(v=>v===undefined)||!values.length)continue
        const orb=Math.max(...values.map(v=>Math.abs(distance(lon,v!)-degrees)))
        if(orb<=(transit==='木星'?5:transit==='土星'?4:3))add(key,day)
      }
      for(const period of periods)if(Date.parse(period.start)<=noon&&noon<Date.parse(period.end)){
        for(let house=1;house<=12;house++)if(RULERS[(ascIndex+house-1)%12]===period.minor)add(`vedic:minor-lord-house:${house}`,day,`vedic:${period.major}:${period.minor}:${period.start}`)
      }
      if(ziwei){
        let yearly=ziweiYears.get(row.lunarYear)
        if(!yearly){yearly=ziwei.horoscope(day,6).yearly;ziweiYears.set(row.lunarYear,yearly)}
        const palace=(name:string)=>name.replace('祿','禄').replace(/宮$/,'')
        add(`ziwei:life:${palace(String(ziwei.palaces[yearly.index]?.name??''))}`,day)
        yearly.mutagen.forEach((star,i)=>{
          const owners=ziwei.palaces.filter(p=>[...p.majorStars,...p.minorStars].some(s=>s.name===star))
          if(owners.length===1)add(`ziwei:${star}:${['化禄','化権','化科','化忌'][i]}:${palace(String(owners[0].name))}`,day)
        })
      }
    }
    output.set(year,[...facts.values()])
  }
  return output
}

/** All conditions must coexist on one day and must not reuse one source fact. */
export function readingSignDays(keys:readonly string[],facts:readonly ReadingSignFact[]):string[]{
  if(!keys.length||keys.length>3||new Set(keys).size!==keys.length)throw new Error('Expected 1–3 distinct signs')
  const groups=keys.map(key=>facts.filter(f=>f.key===key))
  return [...new Set(groups[0].flatMap(f=>f.days))].filter(day=>{
    const pick=(i:number,used:Set<string>):boolean=>i===groups.length||groups[i].some(f=>f.days.includes(day)&&!used.has(f.lineage)&&pick(i+1,new Set([...used,f.lineage])))
    return pick(0,new Set())
  }).sort()
}
