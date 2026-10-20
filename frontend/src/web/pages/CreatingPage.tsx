import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NatureImage, Page, PlainHeader } from '../components/ui'
import { images } from '../data/images'
import { safeReturnTo } from '../../lib/safeReturnTo'

const stages = ['生まれた日の暦を計算しています', '性格の章を書いています', '年ごとの流れを並べています']

/**
 * はじめて読みものをつくるときの待ち時間。
 * 本番：/api/calc/divination → /api/preview/generate（SSEの進み具合をそのまま stages に当てる）。
 * 画面確認用では一定の間隔で進める。
 */
export function CreatingPage({ pending = false }: { pending?: boolean }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [done, setDone] = useState(0)
  const returnTo = params.get('returnTo')
  const next = safeReturnTo(returnTo, '/you')

  useEffect(() => {
    if (pending) return
    if (done >= stages.length) {
      const t = window.setTimeout(() => navigate(next, { replace: true }), 400)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setDone(d => d + 1), 900)
    return () => window.clearTimeout(t)
  }, [done, navigate, next, pending])

  return (
    <Page>
      <PlainHeader />
      <section className="flex flex-col items-center gap-6 px-8 pb-16 pt-14 text-center">
        <NatureImage src={images.moonClouds} className="h-36 w-36 rounded-full" />
        <h1 className="m-0 text-[22px] font-medium leading-relaxed">あなたの読みものを<br />つくっています</h1>
        <ol aria-live="polite" className="m-0 flex w-full max-w-[300px] list-none flex-col gap-3 p-0 text-left">
          {stages.map((stage, i) => {
            const state = i < done ? 'done' : i === done ? 'now' : 'wait'
            return (
              <li key={stage} className={`flex items-center gap-3 text-sm ${state === 'wait' ? 'text-fl-muted' : 'text-fl-ink'}`}>
                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${state === 'done' ? 'bg-fl-moss text-white' : state === 'now' ? 'border-2 border-fl-moss motion-safe:animate-pulse' : 'border border-fl-line'}`}>{state === 'done' ? '✓' : ''}</span>
                <span>{stage}{state === 'done' && <span className="sr-only">（完了）</span>}</span>
              </li>
            )
          })}
        </ol>
        <p className="m-0 text-xs leading-[1.8] text-fl-muted">数秒で終わります。画面はそのままでお待ちください。</p>
      </section>
    </Page>
  )
}
