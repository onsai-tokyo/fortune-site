interface Props {
  reading: string
  isStreaming: boolean
}

function AnalyzingLoader() {
  return (
    <div className="flex items-center justify-center h-32 gap-3">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-accent animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <p className="text-white/50 text-sm">データを解析中...</p>
    </div>
  )
}

export function FortuneReading({ reading, isStreaming }: Props) {
  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 bg-accent rounded-full" />
        <h2 className="text-white font-semibold text-base">解析レポート</h2>
      </div>

      {!reading && isStreaming && <AnalyzingLoader />}

      {reading && (
        <div className="text-white/85 leading-loose text-sm sm:text-base whitespace-pre-wrap">
          {reading}
          {isStreaming && <span className="streaming-cursor" />}
        </div>
      )}
    </div>
  )
}
