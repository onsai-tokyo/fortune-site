/** Editorial candidate labels, never event probabilities. */
export const TIMELINE_TAG_VERSION = 'timeline-tags-reorganization-2.0'
export interface TimelineTag {
  id: string; label: string; source: 'rule_candidate'|'user_reported';
  actor: 'self'|'A'|'B'|'pair'; targetYear: number;
  ruleIds: string[]; evidenceIds: string[]; evidenceText: string;
  state: 'candidate'|'reported'; period?: {start:string;endExclusive:string};
}
export const tagLabels = (tags: TimelineTag[]) => [...new Set(tags.map(t=>t.label))]
export function candidate(id:string,label:string,actor:TimelineTag['actor'],year:number,ruleIds:string[],evidenceIds:string[],text:string):TimelineTag {
  return {id,label,source:'rule_candidate',actor,targetYear:year,ruleIds,evidenceIds,evidenceText:text,state:'candidate'}
}
