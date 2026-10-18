import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, ReportSection, ReportSectionComponent } from '../reportCards.js'
import { annualNarrative } from './timingAnnualNarrative.js'
import { ANNUAL_SIGN_VERSION } from './annualSignAssets.js'

export const ANNUAL_LAYOUT_VERSION = 'annual-three-sections-v1'
export const ANNUAL_HEADINGS = ['この年の中心テーマ', '変化が出る領域', '時期ごとの動き'] as const

// Editorial labels for existing calculated meanings. These do not infer events,
// score a domain, or use observed personal histories as generation inputs.
const DOMAINS: Record<string, [string, string]> = {
  'self-direction': ['自分の選択', '周囲に任せることと、自分で決めることの区別。'],
  'shared-roles': ['人との関わり・自分の目標', '周囲から受ける刺激と、自分のペースの調整。'],
  'expression': ['楽しみ・自己表現', '楽しめることや得意なことを、日々の中でどう生かすか。'],
  'refinement': ['表現・伝え方', 'しっくりこない点の伝え方と、物事の進め方の調整。'],
  'connections': ['交流・活動', '人との接点を、取り組みたいことにつなげること。'],
  'sustainable-living': ['収入・暮らし', '日々の負担と収入を、継続できる形に整えること。'],
  'respond-to-change': ['活動・役目', '変わる状況や慣れていない役目への対応。'],
  'formal-responsibility': ['責任・立場', '自分が担う範囲と、人から求められる役割の具体化。'],
  'new-methods': ['学び・専門性', '慣れた見方を離れ、別の方法を試すこと。'],
  'learning-support': ['学び・支援', '教わることや周囲の支えを、次の準備に生かすこと。'],
  'ties-settle': ['人とのつながり', '続いているつながりの形を確かめること。'],
  'environment-change': ['居場所・活動環境', '場所や担当に合わせた関わり方の調整。'],
  'review-assumptions': ['期待・前提', '当たり前にしていた考えや食い違いの確認。'],
  'new-encounters': ['交流・出会い', '新しく知り合う入口や接点。交際の成立までを示すものではありません。'],
  'hidden-misalignment': ['人との関係・認識', '見えていなかった食い違いや、互いの期待の確認。'],
  'relationship-transition': ['関係の状態', '関係を始める、離れる、つながり直すという複数の方向。'],
  'relationship-restructure': ['関係・生活環境', '付き合い方や生活の場を、今の状況に合わせること。'],
  'relationship-definition-review': ['関係の約束・継続', '今ある関係の約束を具体化することと、続け方の見直し。初めての交際を特定する根拠ではありません。'],
  'relationship-definition': ['関係の約束・継続', '今ある関係も含め、約束や関わり方をはっきりさせること。始まり・継続・終了のどれかは、この根拠だけでは決まりません。'],
  'relationship-decisions': ['関係の将来', 'これからの付き合い方と、互いに望む条件の具体化。'],
}

export function componentBody(components: readonly ReportSectionComponent[]): string {
  return components.map(c => `${c.heading}\n${c.body}`).join('\n\n')
}

export function organizeAnnualCards(cards: ReportCard[], input: Pick<ReportInput, 'timing'>): ReportCard[] {
  return cards.map(card => {
    if (card.metadataRefs?.includes(ANNUAL_LAYOUT_VERSION)) return card
    const year = Number(card.id.match(/^turning-year-(\d{4})$/)?.[1])
    const annual = input.timing?.annual.find(a => a.year === year)
    if (!annual || card.scope !== 'self') return card
    const old = card.sections ?? []
    const theme = old.find(s => s.claimId === `timing-annual-${year}-themes`)
    const relationship = old.find(s => s.claimId === `timing-annual-${year}-relationships`)
    if (!theme && !relationship) return card
    const evidence = theme?.evidence ?? relationship?.evidence ?? []
    const domains = annualNarrative([...annual.themes, ...(annual.relationshipEvents ?? [])]).flatMap(p => {
      const copy = DOMAINS[p.id]
      return copy ? [{heading:copy[0], body:copy[1], evidence, termGloss:[], claimId:`timing-domain:${year}:${p.id}`}] : []
    })
    const periods = old.filter(s => s.claimId?.startsWith(`${ANNUAL_SIGN_VERSION}:`))
      .sort((a,b) => (Number(a.body.match(/^(\d+)月/)?.[1]) || 0) - (Number(b.body.match(/^(\d+)月/)?.[1]) || 0) || a.claimId!.localeCompare(b.claimId!))
    const sections: ReportSection[] = [
      {heading:ANNUAL_HEADINGS[0], body:theme?.body ?? relationship!.body, evidence, termGloss:theme?.termGloss ?? [],
        claimId:`${ANNUAL_LAYOUT_VERSION}:${year}:theme`, sourceClaimIds:[(theme ?? relationship)!.claimId!]},
      {heading:ANNUAL_HEADINGS[1], body:componentBody(domains), evidence, termGloss:[],
        claimId:`${ANNUAL_LAYOUT_VERSION}:${year}:domains`, components:domains,
        sourceClaimIds:[theme?.claimId,relationship?.claimId].filter((v):v is string=>!!v)},
      {heading:ANNUAL_HEADINGS[2], body:periods.length ? componentBody(periods) : 'この入力では、年の中で時期を絞れる根拠が得られていません。月ごとの出来事は補っていません。',
        evidence:periods.flatMap(s=>s.evidence), termGloss:[], claimId:`${ANNUAL_LAYOUT_VERSION}:${year}:periods`,
        components:periods, sourceClaimIds:periods.flatMap(s=>s.claimId?[s.claimId]:[])},
    ]
    return {...card, sections, pages:[{role:'opening',label:'この年の流れ',text:card.summary},...sections.map(s=>({role:'core' as const,label:s.heading,text:s.body}))],
      metadataRefs:[...(card.metadataRefs??[]),ANNUAL_LAYOUT_VERSION]}
  })
}
