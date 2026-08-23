import type { TraitScoreKey, TraitScoreScale } from './traitScores.js'

/**
 * PR-2b bootstrap values. PR-2c/2dでルール投入後、100件のraw分布から
 * calibrateTraitScoreScale()で生成した値へ置換する。手作業で調整しないこと。
 */
export function bootstrapTraitScoreScale(keys: readonly TraitScoreKey[]): Record<TraitScoreKey, TraitScoreScale> {
  return Object.fromEntries(keys.map(key => [key, { center: 0, spread: 1 }])) as Record<TraitScoreKey, TraitScoreScale>
}

function quantile(values: number[], ratio: number): number {
  if (!values.length) return 0
  const ordered = [...values].sort((a, b) => a - b)
  const index = (ordered.length - 1) * ratio
  const lower = Math.floor(index)
  const fraction = index - lower
  return ordered[lower] + ((ordered[lower + 1] ?? ordered[lower]) - ordered[lower]) * fraction
}

export function calibrateTraitScoreScale(
  keys: readonly TraitScoreKey[],
  samples: ReadonlyArray<Partial<Record<TraitScoreKey, number>>>,
): Record<TraitScoreKey, TraitScoreScale> {
  return Object.fromEntries(keys.map(key => {
    const values = samples.map(sample => sample[key]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const center = quantile(values, 0.5)
    const iqr = quantile(values, 0.75) - quantile(values, 0.25)
    // 同値サンプルでも0除算させない。分布不足はPR-2c/2dの検証で失敗させる。
    return [key, { center: Number(center.toFixed(6)), spread: Number(Math.max(iqr / 2, 0.001).toFixed(6)) }]
  })) as Record<TraitScoreKey, TraitScoreScale>
}
