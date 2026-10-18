import { candidateFeatures, type CohortObservation, type DatePrecision } from './cohortPatternCandidates.js'
import { eventWindowDays } from './eventPatternStudy.js'
import type { EventFact } from './eventPatternRules.js'

export const MARRIAGE_STUDY_POLICY = {
  version:'marriage-sign-study-v1', productionEligible:false, trainingEligible:false, qualityEligible:false,
  probability:null, status:'retrospective_hypothesis',
  comparisonMeaning:'other reported event windows, not confirmed marriage-free controls',
} as const
type Predicate = { allOf:string[]; labels:string[]; systems:string[]; groups:string[] }
type Prepared = ReturnType<typeof prepare>
function prepare(event:CohortObservation) {
  const days=eventWindowDays(event.window), features=candidateFeatures(event.facts)
  const byKey=new Map<string,{key:string;label:string;system:string;group:string;mask:bigint}>()
  for(const f of features){
    if(f.days.some(day=>!days.includes(day))) throw new Error('Fact outside study window')
    const selected=new Set(f.days)
    const mask=days.reduce((m,d,i)=>selected.has(d)?m|(1n<<BigInt(i)):m,0n)
    const old=byKey.get(f.key)
    if(old) old.mask|=mask
    else byKey.set(f.key,{key:f.key,label:f.label,system:f.system,group:f.group,mask})
  }
  return {event,days,byKey,features}
}
function overlap(keys:readonly string[],p:Prepared):bigint {
  return keys.reduce((m,key)=>m&(p.byKey.get(key)?.mask??0n),(1n<<BigInt(p.days.length))-1n)
}
function maskDays(mask:bigint,days:string[]) { return days.filter((_,i)=>(mask&(1n<<BigInt(i)))!==0n) }
function count(mask:bigint){let n=0;for(;mask;mask&=mask-1n)n++;return n}
const married=(category:string)=>['結婚','再婚'].includes(category)
const intersects=(a:CohortObservation,b:CohortObservation)=>a.window.from<b.window.until&&b.window.from<a.window.until

function admittedMask(keys:readonly string[],p:Prepared):bigint {
  let mask=overlap(keys,p)
  if(!mask)return 0n
  if(keys.length===3&&new Set(keys.map(k=>p.byKey.get(k)?.system)).size!==3)return 0n
  const sets=keys.map(key=>p.features.filter(f=>f.key===key))
  const shared=sets.some((left,i)=>sets.slice(i+1).some(right=>left.some(a=>right.some(b=>a.lineage===b.lineage))))
  if(!shared)return mask
  const valid=maskDays(mask,p.days).filter(day=>{
    const pick=(i:number,used:Set<string>):boolean=>i===keys.length||sets[i].filter(f=>f.days.includes(day))
      .some(f=>!used.has(f.lineage)&&pick(i+1,new Set([...used,f.lineage])))
    return pick(0,new Set())
  })
  mask=0n;for(const d of valid)mask|=1n<<BigInt(p.days.indexOf(d))
  return mask
}

/** Allows triples only across three different systems; no duplicate interpretation of one fact. */
export function matchMarriageSigns(keys:readonly string[],facts:readonly EventFact[],window:CohortObservation['window']) {
  if(keys.length<1||keys.length>3||new Set(keys).size!==keys.length)throw new Error('Expected 1–3 unique signs')
  const p=prepare({id:'match',personID:'match',category:'',precision:'day',window,facts:[...facts]})
  return maskDays(admittedMask(keys,p),p.days)
}

export function buildMarriageSignStudy(observations:readonly CohortObservation[],existing:readonly Predicate[]) {
  if(new Set(observations.map(o=>o.id)).size!==observations.length)throw new Error('Duplicate observation ID')
  if(existing.some(r=>r.allOf.length<1||r.allOf.length>2||new Set(r.allOf).size!==r.allOf.length))throw new Error('Existing predicates must contain 1–2 unique signs')
  const prepared=observations.map(prepare), positive=prepared.filter(p=>married(p.event.category))
  const definitions=new Map<string,Predicate>(existing.map(p=>[JSON.stringify([...p.allOf].sort()),p]))
  const triples=new Map<string,{predicate:Predicate;people:Set<string>;units:Set<string>}>()
  for(const p of positive){
    const f=[...p.byKey.values()].sort((a,b)=>a.key.localeCompare(b.key))
    for(let i=0;i<f.length;i++)for(let j=i+1;j<f.length;j++)for(let k=j+1;k<f.length;k++){
      const fs=[f[i],f[j],f[k]]
      if(new Set(fs.map(x=>x.system)).size!==3 || (fs[0].mask&fs[1].mask&fs[2].mask)===0n)continue
      const keys=fs.map(x=>x.key),id=JSON.stringify(keys)
      const row=triples.get(id)??{predicate:{allOf:keys,labels:fs.map(x=>x.label),systems:fs.map(x=>x.system),groups:[...new Set(fs.map(x=>x.group))]},people:new Set<string>(),units:new Set<string>()}
      row.people.add(p.event.personID);row.units.add(p.event.independenceUnit??p.event.personID);triples.set(id,row)
    }
  }
  for(const [id,row]of triples)if(row.people.size>=2&&row.units.size>=2)definitions.set(id,row.predicate)
  const comparisons=prepared.filter(p=>!married(p.event.category)&&!positive.some(q=>q.event.personID===p.event.personID&&intersects(p.event,q.event)))
  const classify=(p:Prepared)=>married(p.event.category)?'marriage':comparisons.includes(p)?'other_reported':'overlaps_marriage_window'
  const tally=(rows:Prepared[])=>({records:rows.length,people:new Set(rows.map(p=>p.event.personID)).size,
    uniqueWindows:new Set(rows.map(p=>JSON.stringify([p.event.personID,p.event.window]))).size,
    familyUnits:new Set(rows.map(p=>p.event.independenceUnit??p.event.personID)).size})
  const strata=(rows:Prepared[])=>Object.fromEntries((['day','month','year'] as const).map(precision=>[precision,tally(rows.filter(p=>p.event.precision===precision))]))
  const results=[]
  for(const [id,rule]of definitions){
    const hit=prepared.filter(p=>overlap(rule.allOf,p)!==0n)
    const marriages=hit.filter(p=>married(p.event.category))
    if(new Set(marriages.map(p=>p.event.personID)).size<2||new Set(marriages.map(p=>p.event.independenceUnit??p.event.personID)).size<2)continue
    // Verify lineage-aware matching for retained predicates, including old same-system pairs.
    const masks=new Map(hit.map(p=>[p,admittedMask(rule.allOf,p)]))
    const admitted=hit.filter(p=>masks.get(p)!>0n)
    const positiveHit=admitted.filter(p=>married(p.event.category))
    if(tally(positiveHit).people<2||tally(positiveHit).familyUnits<2)continue
    const otherHit=admitted.filter(p=>comparisons.includes(p))
    results.push({id,...rule,...MARRIAGE_STUDY_POLICY,
      marriage:tally(positiveHit),marriageByPrecision:strata(positiveHit),
      datedMarriage:tally(positiveHit.filter(p=>p.event.precision!=='year')),
      otherReported:tally(otherHit),otherByPrecision:strata(otherHit),
      observedCategories:[...new Set(admitted.map(p=>p.event.category))].sort(),
      supports:admitted.map(p=>{
        const mask=masks.get(p)!,days=maskDays(mask,p.days)
        return {eventID:p.event.id,personID:p.event.personID,category:p.event.category,precision:p.event.precision,
          comparisonClass:classify(p),overlapDays:count(mask),windowDays:p.days.length,firstDay:days[0],lastDay:days.at(-1)!}
      })})
  }
  return {...MARRIAGE_STUDY_POLICY,discovery:{originalDefinitions:existing.length,enumeratedTriples:triples.size,
    repeatedTriples:[...triples.values()].filter(t=>t.people.size>=2&&t.units.size>=2).length},
    denominators:{marriage:tally(positive),marriageByPrecision:strata(positive),otherReported:tally(comparisons),otherByPrecision:strata(comparisons)},
    rules:results.sort((a,b)=>b.datedMarriage.familyUnits-a.datedMarriage.familyUnits||b.marriage.familyUnits-a.marriage.familyUnits||a.id.localeCompare(b.id))}
}
