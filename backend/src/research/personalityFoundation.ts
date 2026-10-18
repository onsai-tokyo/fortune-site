import type { ReportInput } from '../lib/deterministicReport.js'

const STEMS = [...'甲乙丙丁戊己庚辛壬癸']
const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥']
export const PERSONALITY_DAY_PILLARS = Array.from({ length: 60 }, (_, i) => ({
  number: i + 1, kanshi: STEMS[i % 10] + BRANCHES[i % 12],
  stem: STEMS[i % 10], branch: BRANCHES[i % 12],
}))
const PRIMARY_STARS = new Set(['貫索星', '石門星', '鳳閣星', '調舒星', '禄存星', '司禄星', '車騎星', '牽牛星', '龍高星', '玉堂星'])

/**
 * User direction, 2026-09-11: personality is led by Bazi + Sanmei.
 * Research foundation only: preserves exact calculated conditions before prose rules.
 * Sixty day pillars are NOT sixty validated personality types or sixty new texts.
 */
export function buildPersonalityFoundation(input: Pick<ReportInput,
  'fourPillars' | 'sanmeiChart' | 'elementBalance' | 'strength' | 'sanmeiRelations' | 'birthTime'>) {
  const days = (input.fourPillars ?? []).filter(p => p.label === '日柱')
  const day = days.length === 1 ? PERSONALITY_DAY_PILLARS.find(p => p.kanshi === days[0].kanshi) : undefined
  const center = input.sanmeiChart?.bodyChart.center
  const validCenter = center && PRIMARY_STARS.has(center.star) ? center : undefined
  const hasTime = Boolean(input.birthTime)
  return {
    version: 'bazi-sanmei-personality-foundation-v1', deployment: 'research-only',
    status: day && validCenter ? 'foundation-ready' : 'missing-foundation',
    primary: {
      dayPillar: day ? { ...day, source: '四柱推命・日柱' } : null,
      sanmeiCenter: validCenter ? { ...validCenter, source: '算命学・人体星図中央' } : null,
    },
    // A stem-only key would collapse 壬午 and 壬辰 again. Preserve the entire pillar.
    baseKey: day && validCenter ? `day:${day.kanshi}|center:${validCenter.star}` : null,
    modifiers: {
      pillars: (input.fourPillars ?? []).filter(p => p.label !== '時柱' || hasTime),
      sanmeiPositions: input.sanmeiChart?.bodyChart ?? {},
      subordinateStars: input.sanmeiChart?.subordinateStars ?? {},
      elementBalance: input.elementBalance ?? null,
      strength: input.strength ?? null,
      relations: input.sanmeiRelations ?? null,
    },
    policy: {
      mainSystems: ['四柱推命', '算命学'],
      supplementarySystems: ['西洋占星術', 'インド占星術', '紫微斗数'],
      supplementaryMayReplaceFoundation: false,
      agreementIsIndependentProof: false,
      note: '四柱推命と算命学には干支由来の重なりがあるため、同じ内容を独立した二重の裏付けとして加算しない。',
    },
    limitations: [
      '日柱60区分を保持する実装。60種類の性格文や的中率の検証が完成したわけではない。',
      '同じ日柱でも月柱・通変星・蔵干・星の位置などを残して読み分ける。',
      '旺衰は現行計算器の簡易値。数値・閾値の変更や新しい吉凶判定はしない。',
      ...(hasTime ? [] : ['出生時刻不明。時柱を使わず、日付境界での日柱の揺れにも留意する。']),
    ],
  }
}
