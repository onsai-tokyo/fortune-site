import type { NarrativeBlock } from './narrativeV2.js'

const forbiddenByDomain: Partial<Record<NarrativeBlock['domain'], RegExp>> = {
  love: /仕事|職場|キャリア|上司/,
  work: /恋愛|恋人|結婚|パートナー/,
}

export function validateNarrativeBlocks(blocks: NarrativeBlock[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const block of blocks) {
    if (ids.has(block.id)) errors.push(`duplicate block id: ${block.id}`)
    ids.add(block.id)
    if (!block.text.trim()) errors.push(`empty block text: ${block.id}`)
    if (!block.semanticFingerprint.length) errors.push(`empty semantic fingerprint: ${block.id}`)
    if (block.domain === 'compatibility' && !block.when?.relationshipTypes?.length) errors.push(`compatibility block requires relationshipTypes: ${block.id}`)
    if (forbiddenByDomain[block.domain]?.test(block.text)) errors.push(`forbidden domain language: ${block.id}`)
    if (block.role === 'supplement' && block.patternKey !== null) errors.push(`supplement must be axis-generic: ${block.id}`)
  }
  return errors
}
