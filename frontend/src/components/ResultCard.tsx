import type { FortuneData, PartnerData } from '../lib/types'

interface Props {
  data: FortuneData
}

const ELEMENT_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  '木': { bg: 'bg-emerald-400/15', text: 'text-emerald-300', border: 'border-emerald-400/30', dot: 'bg-emerald-400' },
  '火': { bg: 'bg-red-400/15',     text: 'text-red-300',     border: 'border-red-400/30',     dot: 'bg-red-400' },
  '土': { bg: 'bg-amber-400/15',   text: 'text-amber-300',   border: 'border-amber-400/30',   dot: 'bg-amber-400' },
  '金': { bg: 'bg-slate-300/15',   text: 'text-slate-200',   border: 'border-slate-300/30',   dot: 'bg-slate-300' },
  '水': { bg: 'bg-blue-400/15',    text: 'text-blue-300',    border: 'border-blue-400/30',    dot: 'bg-blue-400' },
}

function elementStyle(el: string) {
  return ELEMENT_STYLE[el] ?? { bg: 'bg-white/10', text: 'text-white/60', border: 'border-white/20', dot: 'bg-white/40' }
}

function PillarCell({ label, kanshi, element, yinYang, highlight }: {
  label: string; kanshi: string; element: string; yinYang: string; highlight?: boolean
}) {
  const es = elementStyle(element)
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl p-3 border ${highlight ? `${es.bg} ${es.border}` : 'bg-white/5 border-white/10'}`}>
      <span className="text-white/30 text-[10px] tracking-widest uppercase">{label}</span>
      <span className={`text-2xl font-bold tracking-tight ${highlight ? es.text : 'text-white/80'}`}>{kanshi}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${highlight ? es.dot : 'bg-white/20'}`} />
        <span className="text-white/30 text-[10px]">{element}・{yinYang}</span>
      </div>
    </div>
  )
}

function MetricBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 rounded-lg border ${accent ? 'bg-accent/10 border-accent/25' : 'bg-white/5 border-white/10'}`}>
      <span className="text-white/30 text-[10px] tracking-wider uppercase">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-accent' : 'text-white/80'}`}>{value}</span>
    </div>
  )
}

function ProfileBlock({
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
  const dayEl = shichu.day.element

  return (
    <div className={isPartner ? 'pt-5 border-t border-white/10' : ''}>
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-1 h-5 rounded-full ${isPartner ? 'bg-white/30' : 'bg-accent'}`} />
        <span className="text-white font-semibold text-sm">{title}</span>
        {gender && (
          <span className="text-white/30 text-xs border border-white/10 rounded px-1.5 py-0.5">
            {gender === 'male' ? '♂ 男性' : '♀ 女性'}
          </span>
        )}
        {mbti && (
          <span className="text-accent text-xs border border-accent/30 rounded px-1.5 py-0.5 bg-accent/10">
            {mbti}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          {['四柱推命', '算命学', '宿曜', '納音'].map(s => (
            <span key={s} className="text-white/20 text-[9px] border border-white/10 rounded px-1 py-0.5 hidden sm:inline">{s}</span>
          ))}
        </div>
      </div>

      {/* Day pillar highlight + other pillars */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <PillarCell label="年柱" kanshi={shichu.year.kanshi} element={shichu.year.element} yinYang={shichu.year.yinYang} />
        <PillarCell label="月柱" kanshi={shichu.month.kanshi} element={shichu.month.element} yinYang={shichu.month.yinYang} />
        <PillarCell label="日柱" kanshi={shichu.day.kanshi} element={shichu.day.element} yinYang={shichu.day.yinYang} highlight />
        {shichu.hour
          ? <PillarCell label="時柱" kanshi={shichu.hour.kanshi} element={shichu.hour.element} yinYang={shichu.hour.yinYang} />
          : (
            <div className="flex flex-col items-center gap-1 rounded-xl p-3 border border-white/5 bg-white/3">
              <span className="text-white/20 text-[10px] tracking-widest uppercase">時柱</span>
              <span className="text-white/15 text-lg font-bold">—</span>
              <span className="text-white/15 text-[10px]">不明</span>
            </div>
          )
        }
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricBadge label="納音" value={nayin} accent={!isPartner} />
        <MetricBadge label="宿命星" value={sanmei.shukumeiStar} />
        <MetricBadge label="天中殺" value={sanmei.chusatsu.replace('天中殺', '') + '天中殺'} />
        <MetricBadge label="宿曜" value={`${sukuyo}宿`} />
      </div>

      {/* Primary element tag */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-white/20 text-xs">Primary Element</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${elementStyle(dayEl).bg} ${elementStyle(dayEl).text} ${elementStyle(dayEl).border}`}>
          {dayEl}行
        </span>
        <span className="text-white/20 text-xs">{shichu.day.yinYang}</span>
      </div>
    </div>
  )
}

export function ResultCard({ data }: Props) {
  const { shichu, nayin, sanmei, sukuyo, input, partner } = data

  return (
    <div className="glass-card p-5 space-y-0 animate-fade-in">
      {/* Card header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-5 bg-accent rounded-full" />
        <h2 className="text-white font-semibold text-sm tracking-wide">命式プロファイル</h2>
        <span className="text-white/20 text-xs italic ml-1">Meishiki Dashboard</span>
      </div>

      <ProfileBlock
        title="解析対象"
        shichu={shichu}
        nayin={nayin}
        sanmei={sanmei}
        sukuyo={sukuyo}
        gender={input.gender}
        mbti={input.mbti}
      />

      {partner && (
        <ProfileBlock
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
