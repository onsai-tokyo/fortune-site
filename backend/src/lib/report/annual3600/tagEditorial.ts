import {calcTenGod} from '../../divination/index.js'
import {candidate, TIMELINE_TAG_VERSION, type TimelineTag} from '../timelineTags.js'
import type {AnnualContext, NatalContext, annualReading} from './engine.js'
const CLASH = ['子午','丑未','寅申','卯酉','辰戌','巳亥']
const BREAK = ['子酉','丑辰','寅亥','卯午','巳申','未戌']
const COMBINE=['子丑','寅亥','卯戌','辰酉','巳申','午未'], STEM_COMBINE=['甲己','乙庚','丙辛','丁壬','戊癸']
const HARM = ['子未','丑午','寅巳','卯辰','申亥','酉戌']
const match=(pairs:string[],a:string,b:string)=>pairs.includes(a+b)||pairs.includes(b+a)
export function relationshipReorganization(day:string,annual:string) {
  return match(CLASH,day[1],annual[1])?'clash':match(BREAK,day[1],annual[1])?'break':match(HARM,day[1],annual[1])?'harm':null
}
/** Independent work-domain evidence: excludes day-branch roots of the same relationship signal. */
export function independentCareerSupport(n:NatalContext['natal'],annual:string) {
  const month=n.month,stems='甲乙丙丁戊己庚辛壬癸'
  if(month&&(month[1]===annual[1]||match(COMBINE,month[1],annual[1])||match(CLASH,month[1],annual[1])))return true
  return Object.values(n).some(p=>p&&['正官','偏官','正印','偏印'].includes(calcTenGod(stems.indexOf(n.day![0]),stems.indexOf(p[0])))&&(p[0]===annual[0]||match(STEM_COMBINE,p[0],annual[0])))
}
/** Does not mutate catalogue records or the R01/R02/W01 calculation. */
export function selfTagEditorial(r:NonNullable<ReturnType<typeof annualReading>>,n:NatalContext,input:AnnualContext) {
  const text={...r.text,description:r.text.description.replace('人との約束や日々の選択','人付き合いや日々の選択')},age=r.year-Number(input.birthDate!.slice(0,4)),adult=age>=18
  const yearPillar='甲乙丙丁戊己庚辛壬癸'[r.text.year_cycle_index%10]+'子丑寅卯辰巳午未申酉戌亥'[r.text.year_cycle_index%12]
  const reorg=relationshipReorganization(n.natal.day!,yearPillar),tags:TimelineTag[]=[]
  const has=(kind:string)=>r.labels.some(l=>l.kind===kind)
  const any=(kind:string)=>r.segments.some(s=>s.labels.some(l=>l.kind===kind&&l.state==='candidate'))
  const working=adult&&['employed','independent'].includes(input.workContext??'')
  const careerLabel=working?'#仕事の転機':input.workContext==='student'?'#進路の転機':'#活動の転機'
  const reorgCopy={
    clash:'人間関係の再編では、関わる場や会う頻度を変え、今の生活に合うつながりへ組み替える可能性があります。',
    break:'人間関係の再編では、今までの付き合い方のずれに気づき、関わる人や集まりを選び直す可能性があります。',
    harm:'人間関係の再編では、受け止め方や期待の違いを確かめ、負担の少ない距離感へ整える可能性があります。',
  }
  const reorgText=adult&&reorg?reorgCopy[reorg]:'身近な人との関わり方が変わる場面では、そのときに必要な支えを受け取ることが手がかりになります。'
  text.relationship=text.relationship.replace('新しい交際が始まる可能性も、人によっては結婚へ進む可能性もあります。どのような形になるかは、それぞれの状況によって異なります。','').replace('今の約束を続けられるか','今の関わり方を続けられるか')
  if(reorg) {
    text.relationship+=reorgText
    tags.push(candidate('relationship-reorganization',adult?'#人間関係の再編':'#関わり方の変化','self',r.year,['SELF-REORG-1'],['day-branch:'+reorg],reorgText))
  }
  const relationshipAdditions:string[]=[]
  if(any('marriage')&&adult)relationshipAdditions.push('将来の暮らしを具体的に考え、結婚に向けて関係を育てる可能性があります。')
  if(any('encounter'))relationshipAdditions.push(adult?'紹介や共通の活動から、新しい出会いが生まれる可能性があります。また、身近な人との交流が深まる形で表れることもあります。':'身近な活動を通じて、交流の機会が広がる可能性があります。')
  text.relationship+=relationshipAdditions.join('')
  text.career=text.career.replace('転職や昇進のような大きな変化として表れる可能性があります。また、今の職場で担当や条件を見直す形で取り組むこともできます。','')
  if(!working)text.career=neutralActivityText(text.career)
  if(any('career'))text.career+=(working?'働く環境を見直すことも、この年のテーマです。担当や条件を変える可能性があります。また、職場を離れる準備や、別の環境への移行を検討する形で表れることもあります。':'所属する場や活動の進め方を見直すことも、この年のテーマです。取り組む内容や、関わる場を選び直す可能性があります。')
  const evidence={marriage:relationshipAdditions.find(t=>t.includes('結婚'))??'',encounter:relationshipAdditions.find(t=>t.includes('交流'))??'',career:text.career}
  for(const s of r.segments)for(const l of s.labels.filter(l=>l.state==='candidate')) {
    if(l.kind==='marriage'&&!adult)continue
    const label=l.kind==='marriage'?'#婚期':l.kind==='encounter'?(adult?'#出会いの時期':'#交流が広がる時期'):careerLabel
    const tag=candidate(l.kind,label+(!has(l.kind)?'（年内の一部）':''),'self',r.year,[l.kind==='marriage'?'R02':l.kind==='encounter'?'R01+SOCIAL':'W01'],[r.text.pattern_id],evidence[l.kind])
    tag.period={start:s.start,endExclusive:s.endExclusive};tags.push(tag)
  }
  if(reorg&&has('career')&&adult&&independentCareerSupport(n.natal,yearPillar)) {
    const detail=working?'人間関係と働く環境を再編することが、この年のテーマです。':'人間関係と活動する場を再編することが、この年のテーマです。'
    text.description+=detail
    tags.push(candidate('life-transition','#人生の転機','self',r.year,['SELF-LIFE-1'],['day-branch:'+reorg,'W01'],detail))
  }
  return {text,tags,version:TIMELINE_TAG_VERSION}
}

/** Explicit, domain-local vocabulary map; never infer employment from age or gender. */
function neutralActivityText(text:string) {
 text=text.replaceAll('研修や資格学習に取り組む','必要な知識を学ぶ').replaceAll('必要な資格・手続き・知識をそろえ','必要な知識や手続きをそろえ').replaceAll('顧客や相手','関わる相手')
 const words:[string,string][]=[['働き方','取り組み方'],['職責','責任'],['社内','所属先での'],['顧客','交流相手'],['収入','得られる成果'],['転職','活動の場の変更'],['昇進','役割の広がり'],['同業者','同じ分野の人'],['取引先','協力相手'],['職場','活動の場'],['仕事','活動'],['業務','取り組み'],['案件','課題'],['研修','学び'],['資格','知識'],['報酬','成果'],['給与','活動条件'],['上司','相談相手'],['部下','協力する人'],['同僚','仲間'],['勤務','活動'],['会社','所属先']]
 return words.reduce((s,[from,to])=>s.replaceAll(from,to),text)
}
