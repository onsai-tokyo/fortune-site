import type { StructuredReport } from '../../reportCards.js'
import { finalizeReportProvenance, withCardProvenance } from '../provenance.js'
import { composeCompatibility, relationForMansions, compatibilityKey } from './composer.js'
import { COMPATIBILITY_V24_IDENTITY } from './version.js'
export function buildCompatibilityV24(self:Record<string,unknown>,partner:Record<string,unknown>,relationshipLabel:string):StructuredReport {
  const result=composeCompatibility(self.shichuDay,partner.shichuDay,relationForMansions(self.sukuyo,partner.sukuyo))
  const key=compatibilityKey(result.day_a,result.day_b,result.sukuyo_relation_id)
  const cards=result.sections.map((s,k)=>withCardProvenance({
    id:`compat-v24-${k+1}`,kind:'essence',scope:'couple',tab:'essence',title:s.headline,summary:s.title,
    tags:[s.title,relationshipLabel,'相性'],period:null,
    sections:[{heading:s.title,body:s.body,evidence:[],termGloss:[]}],
    pages:[{role:'core',label:s.title,text:s.body}],evidence:[],
    metadataRefs:[key,...s.source_ids,...s.editorial_rule_ids],
  },'deterministic'))
  return finalizeReportProvenance({version:3,cards,reportText:result.sections.map(s=>`【${s.title}】\n${s.headline}\n\n${s.body}`).join('\n\n')},COMPATIBILITY_V24_IDENTITY)
}
