import { useNavigate } from 'react-router-dom'
import { InputForm } from '../components/InputForm'
import type { FortuneInput, FortuneData, PartnerData } from '../lib/types'
import { calcShichu } from '../lib/shichu'
import { calcNayin } from '../lib/nayin'
import { calcSanmei } from '../lib/sanmei'
import { getSukuyo } from '../lib/sukuyo'

export function TopPage() {
  const navigate = useNavigate()

  function handleSubmit(input: FortuneInput) {
    const [year, month, day] = input.birthDate.split('-').map(Number)
    const hour = input.birthTime ? parseInt(input.birthTime.split(':')[0]) : undefined

    const shichu = calcShichu(year, month, day, hour)
    const nayin  = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(year, month, day)

    let partner: PartnerData | undefined
    if (input.partnerBirthDate) {
      const [py, pm, pd] = input.partnerBirthDate.split('-').map(Number)
      const pHour = input.partnerBirthTime ? parseInt(input.partnerBirthTime.split(':')[0]) : undefined
      const pShichu = calcShichu(py, pm, pd, pHour)
      partner = {
        shichu: pShichu,
        nayin:  calcNayin(pShichu.day.stemIdx, pShichu.day.branchIdx),
        sanmei: calcSanmei(pShichu.day.stemIdx, pShichu.day.branchIdx, pShichu.month.branchIdx),
        sukuyo: getSukuyo(py, pm, pd),
      }
    }

    const fortuneData: FortuneData = { input, shichu, nayin, sanmei, sukuyo, partner }
    navigate('/result', { state: { fortuneData } })
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-16">

        {/* ヘッダー */}
        <header className="text-center mb-12">
          <p className="font-garamond text-xs tracking-[0.3em] text-white/30 italic mb-8 uppercase">
            Meishiki Analysis System
          </p>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 font-serif"
            style={{ background: 'linear-gradient(135deg, #fff 40%, #93c5fd 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            宿命解析システム
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            四柱推命・納音・算命学・宿曜・MBTIを統合し<br />
            あなたの命式から人生戦略を解析します
          </p>

          <div className="mt-6 flex justify-center gap-2 flex-wrap">
            {['四柱推命', '納音', '算命学', '宿曜', 'MBTI'].map(label => (
              <span key={label} className="text-xs border text-white/30 rounded-full px-3 py-0.5" style={{ borderColor: 'rgba(148,163,184,0.2)' }}>
                {label}
              </span>
            ))}
          </div>
        </header>

        {/* 区切り線 */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(148,163,184,0.2))' }} />
          <span className="text-white/20 text-xs font-garamond italic tracking-widest">Analysis</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(148,163,184,0.2))' }} />
        </div>

        {/* 入力フォーム */}
        <div className="glass-card p-6 sm:p-8">
          <InputForm onSubmit={handleSubmit} loading={false} />
        </div>

        {/* フッター */}
        <footer className="mt-10 text-center text-white/15 text-xs font-garamond italic">
          <p>解析結果は意思決定の参考情報としてご活用ください</p>
        </footer>
      </div>
    </div>
  )
}
