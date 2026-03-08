import { useNavigate } from 'react-router-dom'
import { InputForm } from '../components/InputForm'
import type { FortuneInput, FortuneData, PartnerData } from '../lib/types'
import { calcShichu } from '../lib/shichu'
import { calcNayin } from '../lib/nayin'
import { calcSanmei } from '../lib/sanmei'
import { getSukuyo } from '../lib/sukuyo'

const STAR_POSITIONS = [
  { size: 1, top: 8, left: 12, delay: 0 },
  { size: 2, top: 15, left: 88, delay: 0.5 },
  { size: 1, top: 30, left: 5, delay: 1.0 },
  { size: 1, top: 45, left: 95, delay: 0.3 },
  { size: 2, top: 65, left: 8, delay: 0.8 },
  { size: 1, top: 75, left: 92, delay: 1.3 },
  { size: 1, top: 90, left: 25, delay: 0.2 },
  { size: 2, top: 20, left: 50, delay: 1.5 },
  { size: 1, top: 55, left: 60, delay: 0.7 },
  { size: 1, top: 85, left: 70, delay: 1.1 },
]

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
    <div className="min-h-screen relative overflow-hidden">
      {/* 背景の星 */}
      <div className="fixed inset-0 pointer-events-none">
        {STAR_POSITIONS.map((s, i) => (
          <div
            key={i}
            className="absolute text-gold/30 animate-twinkle"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              fontSize: `${s.size * 8}px`,
              animationDelay: `${s.delay}s`,
            }}
          >
            ✦
          </div>
        ))}
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        {/* ヘッダー */}
        <header className="text-center mb-12">
          <div className="text-4xl mb-3">☽ ✦ ☾</div>
          <h1 className="text-4xl sm:text-5xl font-bold font-serif text-gold mb-3 tracking-wider">
            星読み鑑定
          </h1>
          <p className="text-white/60 font-sans text-sm sm:text-base leading-relaxed">
            四柱推命・納音・算命学・宿曜・MBTIを統合した<br className="hidden sm:inline" />
            AI占い師があなたの星を読み解きます
          </p>
          <div className="mt-4 flex justify-center gap-2 text-white/30 text-xs">
            <span>四柱推命</span><span>・</span>
            <span>納音</span><span>・</span>
            <span>算命学</span><span>・</span>
            <span>宿曜</span><span>・</span>
            <span>MBTI</span>
          </div>
        </header>

        {/* 入力フォーム */}
        <div className="glass-card p-6 sm:p-8">
          <h2 className="text-gold font-serif text-xl font-bold mb-6 flex items-center gap-2">
            <span>鑑定情報を入力</span>
          </h2>
          <InputForm onSubmit={handleSubmit} loading={false} />
        </div>

        {/* フッター */}
        <footer className="mt-12 text-center text-white/25 text-xs font-sans">
          <p>※ 占い結果はエンターテインメントとしてお楽しみください</p>
        </footer>
      </div>
    </div>
  )
}
