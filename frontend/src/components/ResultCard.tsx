import type { FortuneData, PartnerData } from '../lib/types'

interface Props {
  data: FortuneData
}

function PillarBlock({ label, kanshi, element, yinYang }: {
  label: string
  kanshi: string
  element: string
  yinYang: string
}) {
  return (
    <div className="text-center">
      <div className="text-white/50 text-xs mb-1 font-serif">{label}</div>
      <div className="text-gold text-xl font-bold font-serif">{kanshi}</div>
      <div className="text-white/50 text-xs mt-1">{element}・{yinYang}</div>
    </div>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-white/5 rounded-xl px-3 py-2 border border-white/10">
      <span className="text-white/50 text-xs mb-1 font-serif">{label}</span>
      <span className="text-white font-bold text-sm font-serif">{value}</span>
    </div>
  )
}

function PersonBlock({
  title, shichu, nayin, sanmei, sukuyo, gender, mbti, isPartner,
}: {
  title: string
  shichu: PartnerData['shichu']
  nayin: string
  sanmei: PartnerData['sanmei']
  sukuyo: string
  gender?: 'male' | 'female'
  mbti?: string
  isPartner?: boolean
}) {
  return (
    <div className={`space-y-4 ${isPartner ? 'pt-4 border-t border-white/10' : ''}`}>
      <div className="flex items-center gap-2">
        <div className={`w-1 h-5 rounded-full ${isPartner ? 'bg-white/40' : 'bg-gold'}`} />
        <span className={`font-serif text-sm font-bold ${isPartner ? 'text-white/70' : 'text-gold'}`}>{title}</span>
        {gender && (
          <span className="text-white/40 text-xs ml-1">{gender === 'male' ? '男性' : '女性'}</span>
        )}
        {mbti && <span className="text-white/50 text-xs bg-white/5 px-2 py-0.5 rounded-full">{mbti}</span>}
      </div>

      {/* 四柱推命 */}
      <div>
        <p className="text-white/40 text-xs font-serif mb-2">◆ 四柱推命</p>
        <div className="grid grid-cols-4 gap-2">
          <PillarBlock label="年柱" kanshi={shichu.year.kanshi} element={shichu.year.element} yinYang={shichu.year.yinYang} />
          <PillarBlock label="月柱" kanshi={shichu.month.kanshi} element={shichu.month.element} yinYang={shichu.month.yinYang} />
          <PillarBlock label="日柱" kanshi={shichu.day.kanshi} element={shichu.day.element} yinYang={shichu.day.yinYang} />
          {shichu.hour
            ? <PillarBlock label="時柱" kanshi={shichu.hour.kanshi} element={shichu.hour.element} yinYang={shichu.hour.yinYang} />
            : <div className="text-center"><div className="text-white/40 text-xs mb-1 font-serif">時柱</div><div className="text-white/25 text-sm">不明</div></div>
          }
        </div>
      </div>

      {/* 納音・算命学・宿曜 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <InfoChip label="納音" value={nayin} />
        <InfoChip label="宿命星" value={sanmei.shukumeiStar} />
        <InfoChip label="天中殺" value={sanmei.chusatsu.replace('天中殺', '')} />
        <InfoChip label="宿曜" value={`${sukuyo}宿`} />
      </div>
    </div>
  )
}

export function ResultCard({ data }: Props) {
  const { shichu, nayin, sanmei, sukuyo, input, partner } = data

  return (
    <div className="glass-card p-6 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="w-1 h-6 bg-gold rounded-full" />
        <h2 className="text-gold font-serif text-lg font-bold">鑑定データ</h2>
      </div>

      <PersonBlock
        title="あなた"
        shichu={shichu}
        nayin={nayin}
        sanmei={sanmei}
        sukuyo={sukuyo}
        gender={input.gender}
        mbti={input.mbti}
      />

      {partner && (
        <PersonBlock
          title="お相手"
          shichu={partner.shichu}
          nayin={partner.nayin}
          sanmei={partner.sanmei}
          sukuyo={partner.sukuyo}
          gender={input.partnerGender}
          mbti={input.partnerMbti}
          isPartner
        />
      )}
    </div>
  )
}
