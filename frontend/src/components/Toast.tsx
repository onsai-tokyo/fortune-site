import { useEffect } from 'react'

interface Props {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'success', onClose, duration = 5000 }: Props) {
  console.log('[Toast] Rendering:', message)

  useEffect(() => {
    console.log('[Toast] Mounted, setting timer for', duration, 'ms')
    const timer = setTimeout(() => {
      console.log('[Toast] Timer expired, closing')
      onClose()
    }, duration)
    return () => {
      console.log('[Toast] Unmounting, clearing timer')
      clearTimeout(timer)
    }
  }, [onClose, duration])

  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        pointerEvents: 'none'
      }}
    >
      <div
        className={`${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl border border-white/20 max-w-md`}
        style={{
          minWidth: '350px',
          pointerEvents: 'auto',
          animation: 'slideDown 0.3s ease-out'
        }}
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">
            {type === 'success' && '🎉'}
            {type === 'error' && '⚠️'}
            {type === 'info' && 'ℹ️'}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-base">{message}</p>
          </div>
          <button
            onClick={() => {
              console.log('[Toast] Close button clicked')
              onClose()
            }}
            className="ml-2 text-white/70 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
