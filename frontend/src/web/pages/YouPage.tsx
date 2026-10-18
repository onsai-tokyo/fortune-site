import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { Card, Footer, ListRow, NatureImage, Page } from '../components/ui'
import { IconChevron, IconClose } from '../components/icons'
import { images } from '../data/images'
import { mockChapters, mockPersonaTitle, mockYears } from '../data/mock'
import { useApp } from '../state/AppState'
import { useCenterCurrent } from '../components/useCenterCurrent'

function formatBirth(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return `${y}年${m}月${d}日生まれ`
}

export function YouPage() {
  const { profile, partners, showGuide, dismissGuide, years, chapters } = useApp()
  const yearList = years.length ? years : mockYears
  const chapterList = chapters.length ? chapters : mockChapters
  const current = yearList.find(y => y.label === '今年') ?? yearList[yearList.length - 1]
  const partner = partners[0]
  const stripRef = useCenterCurrent<HTMLDivElement>(current.year)
  return (
    <Page>
      <SiteHeader current="you" />

      <section className="flex flex-col gap-2.5 px-5 pb-2 pt-7">
        <h1 className="m-0 text-[24px] font-medium leading-[1.55]">{mockPersonaTitle}</h1>
        <p className="m-0 text-sm leading-[1.85] text-fl-body">{profile ? `${formatBirth(profile.birthDate)}${profile.birthTime ? `・${profile.birthTime}・${profile.birthPlace}` : ''}。` : ''}生年月日から読んだ、あなたの性格と年ごとの流れです。</p>
      </section>

      {showGuide && (
        <section className="px-5 pt-5" aria-labelledby="guide-title">
          <div className="relative flex flex-col gap-3 rounded-card bg-fl-cream p-5">
            <button type="button" onClick={dismissGuide} aria-label="案内を閉じる" className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl text-fl-body hover:bg-white/60"><IconClose size={18} /></button>
            <h2 id="guide-title" className="m-0 pr-10 text-base font-medium leading-relaxed">{profile?.nickname ? `${profile.nickname}さん` : 'あなた'}の読みものができました</h2>
            <p className="m-0 text-[13px] leading-[1.8] text-fl-body">ここから読んでみてください。</p>
            <div className="flex flex-col">
              {[
                { to: `/you/years/${current.year}`, title: '今年の流れを読む', sub: `${current.year}年：${current.title}` },
                { to: partner ? `/couple/${partner.id}` : '/couple', title: '大切な人との年表をつくる', sub: '相手の生年月日と出会った年から' },
                { to: '/compose', title: '気になることを相談する', sub: '読みものをもとに、答えを一冊のブックに' },
              ].map(item => (
                <Link key={item.title} to={item.to} className="flex min-h-[60px] items-center gap-3 border-t border-fl-ink/10 py-2">
                  <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-medium">{item.title}</span><span className="text-xs text-fl-body">{item.sub}</span></span>
                  <IconChevron size={16} className="text-fl-body" />
                </Link>
              ))}
            </div>
            {!profile?.birthTime && (
              <Link to="/welcome?returnTo=%2Fyou" className="text-[13px] leading-[1.7] text-fl-slate underline">出生時刻がわかる方は、足すともっと正確に読めます</Link>
            )}
          </div>
        </section>
      )}

      <section className="px-5 pb-2 pt-5">
        <Card className="flex flex-col gap-3 p-5">
          <NatureImage src={images.nature.pampas} className="h-[132px] rounded-xl" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tracking-[0.15em] text-fl-moss">{current.year}年のあなた</span>
            <span className="text-xs text-fl-muted">{current.label}</span>
          </div>
          <h2 className="m-0 text-[19px] font-medium leading-relaxed">{current.title}</h2>
          <p className="m-0 text-sm leading-[1.85] text-fl-body">{current.summary}</p>
          <div className="flex gap-2.5 pt-1">
            <Link to={`/you/years/${current.year}`} className="flex min-h-[46px] flex-1 items-center justify-center rounded-[14px] border border-fl-line text-sm font-medium">続きを読む</Link>
            <Link to={`/compose?source=you-${current.year}`} className="flex min-h-[46px] flex-1 items-center justify-center rounded-[14px] bg-fl-ink text-sm font-medium text-white">この年を相談</Link>
          </div>
        </Card>
      </section>

      <section className="pb-2 pt-5">
        <h3 className="mx-5 mb-3 mt-0 text-base font-medium">年ごとの流れ</h3>
        <div ref={stripRef} className="relative flex gap-2.5 overflow-x-auto px-5 pb-2">
          {yearList.map(y => {
            const on = y.year === current.year
            return (
              <Link key={y.year} to={`/you/years/${y.year}`} aria-current={on ? 'true' : undefined} data-current={on}
                className={`flex min-h-[108px] w-[132px] shrink-0 flex-col gap-1.5 rounded-2xl p-3.5 ${on ? 'bg-fl-ink text-white' : 'border border-fl-line bg-white'}`}>
                <span className={`text-xs ${on ? 'text-fl-line' : 'text-fl-muted'}`}>{y.year}{y.label ? `・${y.label}` : ''}</span>
                <span className="text-sm font-medium leading-normal">{y.title}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col px-5 pb-2 pt-6">
        <h3 className="mb-2 mt-0 text-base font-medium">性格の章</h3>
        {chapterList.map(ch => (
          <ListRow key={ch.id} to={`/you/chapters/${ch.id}`} title={ch.title} sub={ch.sub}
            leading={<NatureImage src={ch.image} className="h-11 w-11 shrink-0 rounded-[10px]" />} />
        ))}
        {!years.length && <span className="pt-2.5 text-xs text-fl-muted">章の名前と文章はサンプルです。</span>}
      </section>

      <section className="px-5 pt-6">
        <Link to={partner ? `/couple/${partner.id}` : '/couple'} className="flex items-center gap-3.5 rounded-card bg-fl-cream p-[18px]">
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-[15px] font-medium">{partner ? `${partner.name}との年表をひらく` : '大切な人との年表をつくる'}</span>
            <span className="text-[13px] text-fl-body">あなたの年と、ふたりの年を見比べる</span>
          </span>
          <IconChevron size={18} />
        </Link>
      </section>

      <Footer />
    </Page>
  )
}
