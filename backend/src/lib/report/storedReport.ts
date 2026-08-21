import type { StructuredReport } from '../reportCards.js'

export function isStructuredReport(value: unknown): value is StructuredReport {
  if (!value || typeof value !== 'object') return false
  const report = value as Record<string, unknown>
  return (report.version === 2 || report.version === 3) && typeof report.reportText === 'string' && Array.isArray(report.cards)
}

export function calculatedDataWithReport(calculatedData: Record<string, unknown>, report: StructuredReport): Record<string, unknown> {
  return { ...calculatedData, _structuredReport: report }
}

export function storedReportFromCalculatedData(calculatedData: unknown): StructuredReport | null {
  if (!calculatedData || typeof calculatedData !== 'object') return null
  const value = (calculatedData as Record<string, unknown>)._structuredReport
  return isStructuredReport(value) ? value : null
}
