import {candidate, TIMELINE_TAG_VERSION, type TimelineTag} from '../timelineTags.js'
import type {Signal} from './title.js'
export interface IndividualCandidates {marriage:boolean|'unknown'; encounter:boolean|'unknown'; references:string[]}
export interface YearEditorialContext {
  relationshipType?: string; relationshipLabel?: string;
  personalCandidates?: [IndividualCandidates,IndividualCandidates]; meeting?: boolean;
}
const wallEffects=new Set(['clash','harm','break','zi_mao_punishment','self_punishment','punishment_two_branches'])
const socialGods=new Set(['偏財','比肩','劫財','食神','傷官'])
const ageMinor=(s:Signal)=>s.age_band!=='adult'
/** Only selected year materials contribute. Natal compatibility and current breakup status do not. */
export function coupleEventEditorial(year:number,signals:Signal[],facts:Record<string,unknown>[],context:YearEditorialContext={}) {
  const tags:TimelineTag[]=[],sentences:string[]=[]
  const adults=signals.filter(s=>s.source==='bazi_main').every(s=>!ageMinor(s))
  const walls=signals.filter(s=>s.source==='bazi_effect'&&wallEffects.has(s.value))
  if(walls.length) {
    const actors=[...new Set(walls.map(s=>s.actor))].sort()
    const subject=actors.length===2?'二人':actors[0]==='A'?'あなた':'相手'
    const sentence=adults?subject+'の関わり方の変化が、二人で向き合う壁になる可能性があります。交流の範囲や関わる頻度を変え、無理の少ない関係へ組み直すことが手がかりになります。':'関わり方の変化に戸惑う場面では、一人ずつの反応と必要な支えを確かめることが手がかりになります。'
    sentences.push(sentence)
    tags.push(candidate('relationship-wall',adults?'#乗り越えるべき壁の到来':'#関わり方を整える時期',actors.length===2?'pair':actors[0],year,['PAIR-WALL-1'],walls.map(s=>s.reference+':'+s.value),sentence))
  }
  const social=signals.filter(s=>s.source==='bazi_main'&&socialGods.has(s.value)&&facts[s.actor==='A'?0:1].relationship_year_review_candidate===true)
  if(social.length) {
    const sentence=adults?'紹介や共通の活動から接点が広がり、互いを知る機会が増える可能性があります。':'身近な活動を通じて、関わる機会が広がる可能性があります。'
    sentences.push(sentence)
    tags.push(candidate('encounter',adults?'#出会いの時期':'#交流が広がる時期','pair',year,['PAIR-ENCOUNTER-1'],social.map(s=>s.reference+':'+s.value),sentence))
  }
  const marriage=adults&&context.relationshipType==='romantic'&&context.personalCandidates?.every(p=>p.marriage===true)
  if(marriage) {
    const sentence='二人の将来や暮らしを具体的に考え、結婚に向けて関係を育てる可能性があります。生活の分担を整え、関係を次の段階へ進める形で表れることもあります。'
    sentences.push(sentence)
    tags.push(candidate('marriage','#婚期','pair',year,['PAIR-MARRIAGE-1'],context.personalCandidates!.flatMap((p,i)=>p.references.map(ref=>(i===0?'A:':'B:')+ref)),sentence))
  }
  return {tags,sentence:sentences.join(''),version:TIMELINE_TAG_VERSION,marriageStatus:!adults||context.relationshipType!=='romantic'?'not_applicable':!context.personalCandidates||context.personalCandidates.some(p=>p.marriage==='unknown')?'needs_personal_context':marriage?'candidate':'not_selected',childrenStatus:'not_implemented'}
}
const scenes=[
  {gods:['劫財','偏財'],title:'人とのつながりから、ふたりが出会う年',text:'知人を介した交流や共通の集まりが、互いを知るきっかけになる可能性があります。'},
  {gods:['食神','傷官'],title:'好きなことを通じて、ふたりが出会う年',text:'好きなことや表現に触れる場が、会話のきっかけになる可能性があります。'},
  {gods:['印綬','偏印'],title:'学びや関心を通じて、ふたりが出会う年',text:'学びや関心のある話題を共有する場が、接点になる可能性があります。'},
  {gods:['正官','偏官'],title:'共通の活動を通じて、ふたりが出会う年',text:'共通の活動で協力する場面が、互いを知るきっかけになる可能性があります。'},
]
export function meetingEditorial(signals:Signal[]) {
  const main=signals.filter(s=>s.source==='bazi_main')
  if(main.some(ageMinor))return {title:'ふたりの接点が生まれ、関わりが始まる年',text:'ふたりの関わりが始まった年です。当時の年齢に合った日常の関わりから、互いを知る接点が生まれた年として読みます。',basis:main}
  const scene=scenes.find(row=>main.some(s=>row.gods.includes(s.value)))
  return {title:scene?.title??'ふたりの接点が生まれ、関わりが始まる年',text:'ふたりの関わりが始まった年です。'+(scene?.text??'日々の交流や会話を重ねる場が、互いを知る接点になる可能性があります。'),basis:scene?main.filter(s=>scene.gods.includes(s.value)):main}
}
