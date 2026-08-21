export interface ConsensusMetric {
  total: number
  ranked: number
  selected: number
  keys: string[]
}

let observer: ((metric: ConsensusMetric) => void) | undefined

export function recordConsensusMetric(metric: ConsensusMetric): void {
  console.info('consensus metric', metric)
  observer?.(metric)
}

// Distribution tests use this hook without parsing console output.
export function observeConsensusMetrics(next?: (metric: ConsensusMetric) => void): void {
  observer = next
}
