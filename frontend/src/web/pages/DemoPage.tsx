import { Link, useNavigate } from 'react-router-dom'
import { Eyebrow, Page, PlainHeader } from '../components/ui'
import { useApp, type DemoPreset } from '../state/AppState'

const screens: { to: string; label: string; preset?: DemoPreset }[] = [
  { to: '/', label: 'トップ（はじめて来た人）', preset: 'first-visit' },
  { to: '/welcome', label: '生年月日の入力（はじめて）', preset: 'first-visit' },
  { to: '/restore', label: 'ログイン', preset: 'first-visit' },
  { to: '/creating', label: '読みものをつくっています' },
  { to: '/you', label: 'あなた' },
  { to: '/you/years/2026', label: '読みものの本文' },
  { to: '/couple/p-misaki?year=2026', label: 'ふたりの年表' },
  { to: '/couple', label: 'ふたり（相手がいないとき）', preset: 'no-partner' },
  { to: '/couple/new', label: '相手を変える' },
  { to: '/compose', label: '一冊つくる' },
  { to: '/compose', label: '一冊つくる（まだ買っていない）', preset: 'zero-credits' },
  { to: '/books', label: '本棚' },
  { to: '/books', label: '本棚（作成に失敗したとき）', preset: 'book-failed' },
  { to: '/books/saved', label: '本棚（保存した読みもの）' },
  { to: '/books/b-distance', label: 'ブックを読む' },
  { to: '/books/b-distance/ask', label: 'ブックへの質問' },
  { to: '/credits', label: '相談のブックを買う' },
  { to: '/credits/return?plan=pack5&status=checking', label: 'お支払い後（確認中）' },
  { to: '/credits/return?plan=pack5&status=done', label: 'お支払い後（完了）' },
  { to: '/credits/return?plan=pack5&status=delayed', label: 'お支払い後（時間がかかっている）' },
  { to: '/settings', label: '設定（この端末だけで利用中）' },
  { to: '/settings', label: '設定（引き継ぎ用メール登録済み）', preset: 'linked' },
  { to: '/settings/link', label: '引き継ぎ用メールの登録' },
  { to: '/tokushoho', label: '特定商取引法に基づく表記' },
]

/** 開発・確認用：全画面と状態への入口（本番では外す） */
export function DemoPage() {
  const { applyDemo } = useApp()
  const navigate = useNavigate()
  return (
    <Page>
      <PlainHeader />
      <section className="flex flex-col gap-2 px-5 pt-7">
        <Eyebrow>確認用</Eyebrow>
        <h1 className="m-0 text-[22px] font-medium">画面一覧</h1>
        <p className="m-0 text-[13px] leading-[1.8] text-fl-muted">押すと、その画面の状態にして開きます。データはすべて仮のものです。</p>
      </section>
      <section className="flex flex-col px-5 pb-12 pt-3">
        {screens.map(s => (
          <button key={s.label} type="button" onClick={() => { applyDemo(s.preset ?? 'default'); navigate(s.to) }}
            className="flex min-h-[52px] items-center justify-between border-b border-fl-line text-left text-[15px]">
            <span>{s.label}</span><span className="text-xs text-fl-muted">{s.to.split('?')[0]}</span>
          </button>
        ))}
        <Link to="/you" className="mt-6 text-sm text-fl-slate underline">通常の状態で使ってみる</Link>
      </section>
    </Page>
  )
}
