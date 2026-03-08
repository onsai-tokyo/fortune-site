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
      <div className="text-white/40 text-xs mb-1">{label}</div>
      <div className="text-white text-lg font-bold">{kanshi}</div>
      <div className="text-white/40 text-xs mt-1">{element}・{yinYang}</div>
    </div>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-deep-navy/60 rounded-lg px-3 py-2 border border-navy-light/50">
      <span className="text-white/40 text-xs mb-1">{label}</span>
      <span className="text-white font-semibold text-sm">{value}</span>
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
    <div className={`space-y-4 ${isPartner ? 'pt-4 border-t border-navy-light/50' : ''}`}>
      <div className="flex items-center gap-2">
        <div className={`w-1 h-4 rounded-full ${isPartner ? 'bg-white/30' : 'bg-accent'}`} />
        <span className="text-sm font-semibold text-white/80">{title}</span>
        {gender && (
          <span className="text-white/30 text-xs">{gender === 'male' ? '男性' : '女性'}</span>
        )}
        {mbti && <span className="text-white/40 text-xs bg-navy-light/50 px-2 py-0.5 rounded">{mbti}</span>}
      </div>

      {/* 四柱推命 */}
      <div>
        <p className="text-white/30 text-xs mb-2">四柱推命パラメータ</p>
        <div className="grid grid-cols-4 gap-2">
          <PillarBlock label="年柱" kanshi={shichu.year.kanshi} element={shichu.year.element} yinYang={shichu.year.yinYang} />
          <PillarBlock label="月柱" kanshi={shichu.month.kanshi} element={shichu.month.element} yinYang={shichu.month.yinYang} />
          <PillarBlock label="日柱" kanshi={shichu.day.kanshi} element={shichu.day.element} yinYang={shichu.day.yinYang} />
          {shichu.hour
            ? <PillarBlock label="時柱" kanshi={shichu.hour.kanshi} element={shichu.hour.element} yinYang={shichu.hour.yinYang} />
            : <div className="text-center"><div className="text-white/30 text-xs mb-1">時柱</div><div className="text-white/20 text-sm">不明</div></div>
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
        <div className="w-1 h-5 bg-accent rounded-full" />
        <h2 className="text-white font-semibold text-base">解析パラメータ</h2>
      </div>

      <PersonBlock
        title="対象者"
        shichu={shichu}
        nayin={nayin}
        sanmei={sanmei}
        sukuyo={sukuyo}
        gender={input.gender}
        mbti={input.mbti}
      />

      {partner && (
        <PersonBlock
          title="比較対象"
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
