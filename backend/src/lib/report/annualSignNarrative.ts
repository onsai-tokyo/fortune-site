import type { ReportCard, ReportSection } from '../reportCards.js'
import { annualSignFacts, readingSignDays, type ReadingSignBirth, type ReadingSignFact } from './annualSignFacts.js'
import { ANNUAL_SIGN_ASSETS, ANNUAL_SIGN_VERSION } from './annualSignAssets.js'

function dateRanges(days:readonly string[]):string {
  const ranges:Array<{from:string;to:string}>=[]
  for(const day of days){const last=ranges.at(-1);if(last&&Date.parse(day)-Date.parse(last.to)===86_400_000)last.to=day;else ranges.push({from:day,to:day})}
  return ranges.map(r=>r.from===r.to?r.from:`${r.from}〜${r.to}`).join('、')
}

export function matchedAnnualSigns(facts:readonly ReadingSignFact[]){
  return ANNUAL_SIGN_ASSETS.flatMap(asset=>{
    const days=readingSignDays(asset.allOf,facts)
    return days.length?[{asset,days}]:[]
  }).sort((a,b)=>b.asset.allOf.length-a.asset.allOf.length||a.asset.id.localeCompare(b.asset.id))
}

/** Keep existing cards, selected years, scores, titles and source meanings intact. */
export function appendAnnualSignReadings(cards:ReportCard[],birth:ReadingSignBirth):ReportCard[]{
  const years=cards.map(c=>Number(c.id.match(/^turning-year-(\d{4})$/)?.[1])).filter(Number.isFinite)
  if(!years.length)return cards
  const byYear=annualSignFacts(birth,years,[...new Set(ANNUAL_SIGN_ASSETS.flatMap(a=>a.allOf))])
  return cards.map(card=>{
    const year=Number(card.id.match(/^turning-year-(\d{4})$/)?.[1]),matches=matchedAnnualSigns(byYear.get(year)??[])
    // Avoid repeating a single or pair already explained by a more specific condition
    // on the same days. Specificity controls presentation only, never confidence.
    const selected:typeof matches=[]
    for(const match of matches){
      if(selected.some(other=>match.asset.allOf.every(k=>other.asset.allOf.includes(k))&&match.days.every(d=>other.days.includes(d))))continue
      selected.push(match);if(selected.length===3)break
    }
    if(!selected.length)return card
    const sections:ReportSection[]=selected.map(({asset,days})=>{
      const months=[...new Set(days.map(d=>Number(d.slice(5,7))))]
      const period=months.length===12?'一年の中で':`${months.map(m=>m+'月').join('・')}ごろに`
      const evidence=asset.labels.map((detail,i)=>({system:asset.allOf[i].startsWith('vedic:')?'インド占星術':asset.allOf[i].startsWith('western:')?'西洋占星術':asset.allOf[i].startsWith('ziwei:')?'紫微斗数':asset.allOf[i].startsWith('sanmei:')?'算命学':'四柱推命',family:asset.allOf[i].startsWith('vedic:')||asset.allOf[i].startsWith('western:')?'天体系':asset.allOf[i].startsWith('ziwei:')?'紫微系':'干支系',detail:`${detail}。成立日（日次・JST正午サンプル）：${dateRanges(days)}。出生時刻は入力値、角度は都道府県庁代表座標。近似Lahiri・365.25日/年。出来事の発生確率は未評価。`}))
      return {heading:asset.title,body:`${period}、${asset.body}`,evidence,termGloss:[],claimId:`${ANNUAL_SIGN_VERSION}:${year}:${asset.id}`}
    })
    return {...card,sections:[...(card.sections??[]),...sections],
      pages:[...card.pages,...sections.map(section=>({role:'core' as const,label:section.heading,text:section.body}))],
      evidence:[...card.evidence,...sections.flatMap(s=>s.evidence)],
      metadataRefs:[...(card.metadataRefs??[]),...selected.map(m=>`${ANNUAL_SIGN_VERSION}:${m.asset.id}`)]}
  })
}
