interface Props {
  text: string
  hashtags?: string[]
}

export function ShareButton({ text, hashtags = ['命式鑑定', 'fate_lab'] }: Props) {
  function handleShare() {
    const hashtagStr = hashtags.map(h => `#${h}`).join(' ')
    const url = 'https://fate-lab.com'
    const tweetText = encodeURIComponent(`${text}\n\n${hashtagStr}\n${url}`)
    window.open(`https://x.com/intent/tweet?text=${tweetText}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 hover:border-white/30 text-white/50 hover:text-white/80 text-xs font-medium transition-all"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
      結果をXでシェア
    </button>
  )
}
