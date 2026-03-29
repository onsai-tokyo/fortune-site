import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    Payjp?: (key: string) => PayjpInstance
    _payjpInstance?: PayjpInstance
  }
}

interface PayjpElement {
  mount: (selector: string) => void
  unmount: () => void
}

interface PayjpInstance {
  elements: () => {
    create: (type: string, options?: object) => PayjpElement
  }
  createToken: (element: PayjpElement) => Promise<Record<string, unknown>>
}

interface Props {
  mode: 'one-time' | 'subscription' | 'points'
  title: string
  amount: number
  pts?: number
  isProcessing: boolean
  error: string
  onToken: (payjpToken: string) => void
  onClose: () => void
}

export function PayjpModal({ mode, title, amount, pts, isProcessing, error, onToken, onClose }: Props) {
  const [localError, setLocalError] = useState('')
  const payjpRef = useRef<PayjpInstance | null>(null)
  const numberElementRef = useRef<PayjpElement | null>(null)

  useEffect(() => {
    const publicKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_PAYJP_PUBLIC_KEY
    if (!window.Payjp || !publicKey) return

    if (!window._payjpInstance) {
      window._payjpInstance = window.Payjp(publicKey)
    }
    payjpRef.current = window._payjpInstance
    const elements = window._payjpInstance.elements()

    const style = { base: { color: 'rgba(255,255,255,0.85)', fontSize: '14px', '::placeholder': { color: 'rgba(255,255,255,0.25)' } } }
    const numberEl = elements.create('cardNumber', { style })
    const expiryEl = elements.create('cardExpiry', { style })
    const cvcEl = elements.create('cardCvc', { style })

    numberElementRef.current = numberEl
    numberEl.mount('#payjp-card-number')
    expiryEl.mount('#payjp-card-expiry')
    cvcEl.mount('#payjp-card-cvc')

    return () => {
      numberEl.unmount()
      expiryEl.unmount()
      cvcEl.unmount()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!payjpRef.current || !numberElementRef.current || isProcessing) return

    setLocalError('')
    const result = await payjpRef.current.createToken(numberElementRef.current)
    console.log('PAY.JP createToken result:', JSON.stringify(result))

    // PAY.JP returns { error: {...} } on failure, or token object at root on success
    const err = result.error as { message?: string } | undefined
    if (err) {
      setLocalError(err.message ?? 'カード情報の取得に失敗しました')
      return
    }

    // Token may be at result.token.id or result.id (depending on SDK version)
    const tokenId = (result.token as { id?: string } | undefined)?.id ?? result.id as string | undefined
    if (!tokenId) {
      setLocalError('カード情報の取得に失敗しました')
      return
    }

    onToken(tokenId)
  }

  const displayError = localError || error

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-sm p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-white font-semibold">{title}</h3>
            {mode === 'subscription' && (
              <p className="text-accent text-xs mt-0.5">毎月自動更新 · いつでも解約可能</p>
            )}
          </div>
          <button onClick={onClose} disabled={isProcessing} className="text-white/40 hover:text-white/70 text-lg leading-none">✕</button>
        </div>

        <div className="glass-card p-3 space-y-1" style={{ background: 'rgba(148,163,184,0.05)' }}>
          {mode === 'points' ? (
            <>
              <p className="text-white/40 text-xs">自己分析・相性診断・AIチャットなどで消費</p>
              <div className="flex items-baseline gap-2">
                <span className="text-white font-bold text-2xl">¥{amount.toLocaleString()}</span>
                <span className="text-white/40 text-xs">→ {pts}pt 付与</span>
              </div>
            </>
          ) : mode === 'one-time' ? (
            <>
              <p className="text-white/40 text-xs">6占術 AI統合命式鑑定書（全30ページ）</p>
              <div className="flex items-baseline gap-2">
                <span className="text-white font-bold text-2xl">¥{amount.toLocaleString()}</span>
                <span className="text-white/40 text-xs">ワンタイム · PDF自動生成</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-white/40 text-xs">月額サブスク — 毎月ポイント付与・自己分析・AIチャットに使えます</p>
              <div className="flex items-baseline gap-2">
                <span className="text-white font-bold text-2xl">¥{amount.toLocaleString()}</span>
                <span className="text-white/40 text-xs">/月（税込）</span>
              </div>
              {pts && <p className="text-accent/70 text-xs font-medium">毎月 {pts}pt 付与</p>}
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-white/50 text-xs mb-1 block">カード番号</label>
            <div id="payjp-card-number" className="bg-navy-light border border-white/10 rounded-lg px-3 py-3 min-h-[44px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs mb-1 block">有効期限</label>
              <div id="payjp-card-expiry" className="bg-navy-light border border-white/10 rounded-lg px-3 py-3 min-h-[44px]" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">CVC</label>
              <div id="payjp-card-cvc" className="bg-navy-light border border-white/10 rounded-lg px-3 py-3 min-h-[44px]" />
            </div>
          </div>

          {displayError && <p className="text-red-400 text-xs">{displayError}</p>}

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-lg transition-all disabled:opacity-50 text-sm"
          >
            {isProcessing ? '処理中...' : mode === 'points' ? `¥${amount.toLocaleString()}で${pts}pt購入する` : mode === 'subscription' ? `¥${amount.toLocaleString()}/月で${pts}pt/月プランを始める` : `¥${amount.toLocaleString()}で鑑定書を受け取る`}
          </button>

          <p className="text-white/20 text-xs text-center">PAY.JP による安全な決済</p>
        </form>
      </div>
    </div>
  )
}
