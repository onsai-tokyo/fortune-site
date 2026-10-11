/**
 * v3.33 (proposed): the work context to word a year with.
 * The registered work context describes the person now. A past year up to age 22 says nothing about whether a person
 * who works now was already working then, so for 'employed' / 'independent' those years use the neutral wording
 * (undefined → 'other' / neutral activity text). A person who is a student now was in school in those years too, so
 * 'student' is kept. Wording only: never changes a judgement (career / move / theme stay the same).
 */
import type { TimelineContext } from './signals.js'
export const NEUTRAL_WORK_UNTIL_AGE = 22
export function workContextFor(ctx: TimelineContext, year: number, past: boolean): string | undefined {
  const w = ctx.input.workContext
  if (past && year - ctx.birthYear <= NEUTRAL_WORK_UNTIL_AGE && (w === 'employed' || w === 'independent')) return undefined
  return w
}
