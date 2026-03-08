interface Props {
  reading: string
  isStreaming: boolean
}

function StarLoader() {
  const positions = [
    { top: '10%', left: '15%', delay: '0s', size: 'text-xs' },
    { top: '20%', left: '80%', delay: '0.3s', size: 'text-base' },
    { top: '50%', left: '5%', delay: '0.6s', size: 'text-sm' },
    { top: '70%', left: '90%', delay: '0.9s', size: 'text-xs' },
    { top: '85%', left: '40%', delay: '1.2s', size: 'text-base' },
    { top: '35%', left: '55%', delay: '0.4s', size: 'text-xs' },
    { top: '60%', left: '70%', delay: '0.8s', size: 'text-sm' },
  ]

  return (
    <div className="relative h-40 flex items-center justify-center">
      {positions.map((pos, i) => (
        <span
          key={i}
          className={`absolute ${pos.size} text-gold animate-twinkle`}
          style={{ top: pos.top, left: pos.left, animationDelay: pos.delay }}
        >
          ✦
        </span>
      ))}
      <div className="text-center z-10">
        <div className="text-4xl mb-3 animate-spin-slow inline-block">☽</div>
        <p className="text-white/60 text-sm font-serif">星々が語りかけています...</p>
      </div>
    </div>
  )
}

export function FortuneReading({ reading, isStreaming }: Props) {
  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 bg-gold rounded-full" />
        <h2 className="text-gold font-serif text-lg font-bold">統合鑑定</h2>
      </div>

      {!reading && isStreaming && <StarLoader />}

      {reading && (
        <div className="text-white/85 leading-loose font-sans text-sm sm:text-base whitespace-pre-wrap">
          {reading}
          {isStreaming && <span className="streaming-cursor" />}
        </div>
      )}
    </div>
  )
}
