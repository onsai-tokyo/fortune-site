type Props = {
  matched: number
  lineages?: string[]
  size?: 'sm' | 'md'
}

export default function AgreementSeal({ matched, lineages = [], size = 'md' }: Props) {
  const count = Math.max(0, Math.min(4, Math.floor(matched)))
  const diameter = size === 'sm' ? 10 : 14
  const gap = size === 'sm' ? 4 : 6
  const width = diameter * 4 + gap * 3
  const lineageText = lineages.length ? `（${lineages.join('・')}）` : ''

  return (
    <svg width={width} height={diameter} viewBox={`0 0 ${width} ${diameter}`} role="img" aria-label={`4系統のうち${count}系統が一致${lineageText}`}>
      {Array.from({ length: 4 }, (_, index) => (
        <circle
          key={index}
          cx={diameter / 2 + index * (diameter + gap)}
          cy={diameter / 2}
          r={(diameter - 1) / 2}
          fill={index < count ? '#9A6D16' : 'none'}
          stroke={index < count ? 'none' : '#C9B584'}
          strokeWidth="1"
          style={{ animation: 'seal-reveal .16s ease-out forwards', animationDelay: `${index * 80}ms`, opacity: 0 }}
        />
      ))}
    </svg>
  )
}
