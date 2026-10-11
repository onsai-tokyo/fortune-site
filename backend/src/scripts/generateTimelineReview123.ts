/** Offline TestFlight UI review data. No API/DB access. */
import { writeFileSync } from 'node:fs'
import { timelineV3Cards } from '../lib/report/timelineV3/compose.js'
import { buildCoupleTimelineV3 } from '../lib/report/timelineV3/couple.js'
import { TIMELINE_V3_SAMPLES, COUPLE_SAMPLES } from '../lib/report/timelineV3/samples.js'
const compact = (c: any) => ({ id:c.id, kind:c.kind, tab:c.tab, scope:c.scope, title:c.title, summary:c.summary, tags:c.tags, period:c.period, pages:c.pages, sections:c.sections, evidence:c.evidence, timelineV3Calculation:c.timelineV3Calculation && {version:c.timelineV3Calculation.version} })
const groups = [
 { id:'self-employed', title:'あなた A・会社員', note:'2015年は20歳。2017年は22歳、2018年は23歳の確認用です。', cards:timelineV3Cards(TIMELINE_V3_SAMPLES.aichi_1995_female_married,2013,2026,2026,'simple').map(compact) },
 { id:'self-independent', title:'あなた B・自営', note:'2012年は22歳、2013年は23歳の確認用です。', cards:timelineV3Cards(TIMELINE_V3_SAMPLES.tokyo_1990_male_independent,2010,2026,2026,'simple').map(compact) },
 { id:'couple', title:'ふたり・元恋人', note:'ふたりの簡易表示も、同じ更新後エンジンから生成しています。', cards:buildCoupleTimelineV3({...COUPLE_SAMPLES.former,referenceYear:2026,style:'simple'}).entries.filter(e=>e.year<=2026&&e.card).map(e=>compact(e.card)) },
]
if(!groups[0].cards.some(c=>c.tags.includes('#活動の転機の候補')))throw new Error('Missing activity tag sample')
writeFileSync(new URL('../../../ios/FateLab/TimelineTextReviewData.swift',import.meta.url),'#if FATELAB_TIMELINE_REVIEW\nimport Foundation\nenum TimelineTextReviewData {\n    static let data = Data(#"""\n'+JSON.stringify(groups,null,2)+'\n"""#.utf8)\n}\n#endif\n')
console.log(groups.map(g=>`${g.id}: ${g.cards.length} cards`).join('\n'))
