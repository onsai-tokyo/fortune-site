/** Civil key projection of the existing February..January flow-year sequence.
 * Not a solar-term boundary oracle; all resulting diagnostic runs remain ineligible.
 */
export function projectTimingMonth(sourceYear: number, index: number) {
  if (!Number.isInteger(sourceYear) || sourceYear < 1 || sourceYear > 9998) throw new Error('Invalid source year')
  if (!Number.isInteger(index) || index < 0 || index > 11) throw new Error('Invalid flow month index')
  const civilYear = index === 11 ? sourceYear + 1 : sourceYear
  const civilMonth = index === 11 ? 1 : index + 2
  return {
    sourceYear, civilYear, civilMonth, grain: 'month' as const,
    calendarSystem: 'gregorian_key_projection' as const,
    key: `${civilYear}-${String(civilMonth).padStart(2, '0')}`,
    qualityEligible: false as const,
  }
}
