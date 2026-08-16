interface ReportInput {
  birthDate?: string
  birthTime?: string
  birthplace?: string
  gender?: string
  age?: number
  shichuDay: string
  nayin: string
  sanmeiStar: string
  chusatsu: string
  sukuyo: string
  lifePathNumber: number
  honmeiName: string
  numerologyProfile?: { birthDayNumber: number; attitudeNumber: number; personalYearNumber: number; personalYear: number }
  kyuseiProfile?: { yearStar: string; monthStar: string; dayStar: string; timeStar: string | null }
  fourPillars?: Array<{ label: string; kanshi: string; stemTenGod: string; hiddenStems: Array<{ stem: string; tenGod: string }> }>
  elementBalance?: { scores: Record<string, number>; method: string }
  strength?: { label: string; supportRatio: number; favorableElements: string[]; note: string }
  sanmeiChart?: {
    bodyChart: Record<string, { label: string; star: string }>
    subordinateStars: Record<string, { label: string; star: string; stage: string }>
  }
  timing?: {
    direction: string
    startDate: string
    decades: Array<{ startYear: number; endYear: number; startAge: number; endAge: number; kanshi: string; tenGod: string; themes: string[] }>
    annual: Array<{ year: number; ageRange: string; kanshi: string; tenGod: string; score: number; relationshipSignals: string[]; sanmeiSignals?: string[]; themes: string[] }>
    marriageCandidates: Array<{ year: number; ageRange: string; kanshi: string; tenGod: string; score: number; relationshipSignals: string[]; sanmeiSignals?: string[]; themes: string[] }>
  }
  sanmeiRelations?: {
    relations: Array<{ pillars: string; branches: string; relation: string; meaning: string }>
    voidBranches: string[]
    affectedPillars: string[]
  }
  ziwei?: {
    available: boolean
    birthplace: string
    reason?: string
    standardTimeNote?: string
    lunarDate?: string
    time?: string
    timeRange?: string
    fiveElementsClass?: string
    soul?: string
    body?: string
    earthlyBranchOfSoulPalace?: string
    earthlyBranchOfBodyPalace?: string
    palaces?: Array<{
      name: string; heavenlyStem: string; earthlyBranch: string; isBodyPalace: boolean
      majorStars: Array<{ name: string; brightness: string; mutagen: string; detail: string }>
      minorStars: string[]
      decadal: { range: number[]; heavenlyStem: string; earthlyBranch: string }
    }>
    annual?: Array<{ year: number; heavenlyStem: string; earthlyBranch: string; activePalaces: string[]; mutagenStars: string[]; signals: string[] }>
  }
  astrology?: {
    available: boolean
    reason?: string
    method: string
    western?: {
      ascendant: { sign: string; degree: number }
      midheaven?: { sign: string; degree: number }
      planets: Array<{ name: string; longitude: number; sign: string; degree: number; retrograde: boolean }>
      aspects: string[]
    }
    vedic?: {
      ayanamsha: number
      ascendant: { sign: string; degree: number }
      midheaven?: { sign: string; degree: number }
      planets: Array<{ name: string; longitude: number; sign: string; degree: number; retrograde: boolean }>
      moonNakshatra: string
      moonPada: number
    }
    annual?: Array<{ year: number; western: string[]; vedic: string[]; dashaLord: string; signals: string[] }>
  }
}

export type ReportBlock = { id: string; render: () => string }

export type ConsensusFamily = 'stems' | 'ephemeris' | 'number' | 'lunar'

export type FamilyVerdict<Theme extends string = string> = {
  family: ConsensusFamily
  theme: Theme | null
  strength: number
  split: boolean
  supporting: string[]
  opposing: string[]
}

export type TwoStageConsensusItem<Theme extends string = string> = {
  key: Theme
  sources: string[]
  count: number
  lineages: ConsensusFamily[]
  lineageCount: number
  score: number
  familyVerdicts: FamilyVerdict<Theme>[]
}

/**
 * Each calculation family can contribute at most one vote to a theme.
 * Nayin is intentionally absent from familySystems: it is derived from the
 * same stem/branch data and is retained as evidence only, not as a voter.
 */
export function buildTwoStageConsensus<Theme extends string>(
  signals: Map<Theme, Set<string>>,
  sourceFamily: Record<string, ConsensusFamily>,
  familySystems: Record<ConsensusFamily, string[]>,
  strengths: Map<Theme, Map<string, number>> = new Map(),
) {
  const verdicts: FamilyVerdict<Theme>[] = []
  const items: TwoStageConsensusItem<Theme>[] = []

  for (const [theme, sourceSet] of signals.entries()) {
    const accepted: FamilyVerdict<Theme>[] = []
    for (const family of Object.keys(familySystems) as ConsensusFamily[]) {
      const systems = familySystems[family]
      const supporting = systems.filter(system => sourceSet.has(system) && sourceFamily[system] === family)
      if (!supporting.length) continue
      const opposing = systems.filter(system => !sourceSet.has(system))
      const required = Math.floor(systems.length / 2) + 1
      const passed = supporting.length >= required
      const signalStrength = supporting.reduce((sum, system) => sum + (strengths.get(theme)?.get(system) ?? 1), 0) / supporting.length
      const verdict: FamilyVerdict<Theme> = {
        family,
        theme: passed ? theme : null,
        strength: signalStrength,
        split: !passed,
        supporting,
        opposing,
      }
      verdicts.push(verdict)
      if (passed) accepted.push(verdict)
    }

    if (!accepted.length) continue
    const sources = accepted.flatMap(verdict => verdict.supporting)
    const averageStrength = accepted.reduce((sum, verdict) => sum + verdict.strength, 0) / accepted.length
    items.push({
      key: theme,
      sources,
      count: sources.length,
      lineages: accepted.map(verdict => verdict.family),
      lineageCount: accepted.length,
      score: averageStrength,
      familyVerdicts: accepted,
    })
  }

  items.sort((a, b) => b.lineageCount - a.lineageCount || b.score - a.score || b.count - a.count || a.key.localeCompare(b.key))
  return { items, verdicts, splitVerdicts: verdicts.filter(verdict => verdict.split) }
}

export function renderReportBlocks(blocks: ReportBlock[], context = ''): string {
  return blocks.flatMap(block => {
    try {
      const text = block.render().trim()
      return text ? [text] : []
    } catch (error) {
      console.error(`Deterministic report block failed: ${block.id}`, {
        context,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return []
    }
  }).join('\n\n')
}

const DAY_STEM: Record<string, { core: string; strength: string; caution: string; work: string; love: string }> = {
  甲: { core: 'まっすぐ成長し続ける開拓者', strength: '長期的な目標を掲げ、周囲を巻き込みながら道を切り開く力', caution: '正しさを急ぐほど、相手の事情を置き去りにしやすいこと', work: '新規事業、企画、教育、組織づくり', love: '互いの成長を応援し、率直に話し合える関係' },
  乙: { core: '柔軟さの中に強い芯を持つ調整役', strength: '相手や環境を観察し、最適な形へ整えていく力', caution: '周囲に合わせ続けて、本音を後回しにしやすいこと', work: '編集、デザイン、接客、調整、育成', love: '細やかな気遣いを言葉で返してくれる関係' },
  丙: { core: '場を明るく照らす表現者', strength: '物事の魅力を見つけ、わかりやすく人へ伝える力', caution: '反応を急ぎ、地道な確認を省きやすいこと', work: '広報、営業、表現、イベント、リーダー職', love: '感情を隠さず、喜びを共有できる関係' },
  丁: { core: '静かな情熱で人を導く洞察者', strength: '小さな変化を捉え、必要な人へ深く働きかける力', caution: '考えを内側にため込み、急に距離を置きやすいこと', work: '研究、文章、企画、相談支援、専門職', love: '精神的な深さと安心を共有できる関係' },
  戊: { core: '揺るがない基盤をつくる守護者', strength: '複雑な状況を受け止め、長く続く仕組みに変える力', caution: '一度決めた方法を変えるまでに時間がかかること', work: '経営、管理、金融、不動産、運用', love: '信頼を積み重ね、生活感覚を共有できる関係' },
  己: { core: '人と資源を育てる実務家', strength: '散らばった情報を整理し、成果が育つ環境を整える力', caution: '心配が増えるほど細部を管理しすぎること', work: '管理、経理、教育、医療福祉、品質改善', love: '日常の小さな約束を大切にする関係' },
  庚: { core: '決断と改革を担う実行者', strength: '不要なものを見極め、停滞を打ち破る力', caution: '結論を急ぎ、言葉が鋭くなりやすいこと', work: '技術、法務、改革、交渉、危機管理', love: '対等で、率直な意見交換ができる関係' },
  辛: { core: '価値を磨き上げる専門家', strength: '品質の違いを見抜き、完成度を高める力', caution: '理想が高くなり、自分にも他人にも厳しくなること', work: '美容、工芸、分析、監査、ブランド設計', love: '品位と境界線を尊重し合える関係' },
  壬: { core: '大きな流れを読む戦略家', strength: '広い視野で情報をつなぎ、可能性を広げる力', caution: '選択肢を増やしすぎて、着地が遅れること', work: '戦略、貿易、IT、メディア、コンサルティング', love: '自由と信頼を両立できる関係' },
  癸: { core: '感受性で本質を潤す探究者', strength: '目に見えない変化を察知し、知恵として蓄える力', caution: '刺激を受けすぎて、判断に迷いやすいこと', work: '研究、創作、心理、データ分析、支援職', love: '静かな時間と繊細さを守ってくれる関係' },
}

const SANMEI: Record<string, string> = {
  貫索星: '自立心と一貫性', 石門星: '協調性と人脈形成', 鳳閣星: '自然体の表現力', 調舒星: '鋭い感性と独創性',
  禄存星: '人を引きつける奉仕性', 司禄星: '蓄積と生活設計', 車騎星: '即断即決の行動力', 牽牛星: '責任感と役割意識',
  龍高星: '未知を学ぶ改革性', 玉堂星: '知識を受け継ぎ伝える力',
}

const ASTRO_SIGN: Record<string, string> = {
  牡羊座: '自分から始め、率直に切り開く力', 牡牛座: '感覚と現実性を大切にし、価値を育てる力', 双子座: '情報を集め、言葉でつなぐ力', 蟹座: '身近な人を守り、安心できる場を作る力',
  獅子座: '創造性と誇りを表現し、周囲を照らす力', 乙女座: '細部を整え、役に立つ形へ改善する力', 天秤座: '複数の立場を調整し、美しい均衡を作る力', 蠍座: '一つの対象を深く掘り、根本から変える力',
  射手座: '視野を広げ、意味や可能性を探究する力', 山羊座: '目標を現実の仕組みへ変え、責任を果たす力', 水瓶座: '既存の枠を越え、独自の仕組みを考える力', 魚座: '境界を越えて感じ取り、想像力で包み込む力',
}
const ZODIAC_SIGNS = ['牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座', '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座']
const PARTNER_GROWTH: Record<string, string> = {
  牡羊座: '挑戦を恐れず、自分で道を開く人', 牡牛座: '生活と仕事を着実に育てられる人', 双子座: '好奇心があり、学びを会話で共有できる人',
  蟹座: '身近な人を守り、安心できる居場所を作れる人', 獅子座: '自信と敬意を持ち、周囲を励ませる人', 乙女座: '技術を磨き、誠実に役立とうとする人',
  天秤座: '対等な協力関係を築ける人', 蠍座: '一つのことを深く学び、信頼を守れる人', 射手座: '視野が広く、互いの成長を応援できる人',
  山羊座: '経験を積み、長期的な責任を果たせる人', 水瓶座: '個性を尊重し、未来の考えを共有できる人', 魚座: '共感と想像力を持ち、弱さも受け止められる人',
}

type PlanetRole = 'lagna' | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'
const PLANET_ROLE_PREFIX: Record<PlanetRole, string> = {
  lagna: '物事に取り組むときは', sun: '人生の軸として', moon: '心を落ち着けるには', mercury: '考えを伝えるときは',
  venus: '人や物を大切にするときは', mars: '行動を起こすときは', jupiter: '可能性を伸ばすときは', saturn: '成熟の課題として',
}
const SIGN_BEHAVIOR: Record<string, Record<PlanetRole, string>> = {
  牡羊座: { lagna: 'まず動いて手応えを確かめます', sun: '自分で先頭に立つ経験を選びます', moon: '率直に反応できる余白が必要です', mercury: '結論を素早く言葉にします', venus: '熱意が伝わる相手へ惹かれます', mars: '迷う前に最初の一歩を踏み出します', jupiter: '挑戦の数だけ視野が広がります', saturn: '衝動を持続力へ変えていきます' },
  牡牛座: { lagna: '感覚を確かめてから腰を据えます', sun: '確かな価値を育て続けます', moon: '五感と生活の安定が必要です', mercury: '実例を交えて着実に話します', venus: '安心と誠実さを感じる相手を選びます', mars: '急がず粘り強く進めます', jupiter: '資源を育てるほど豊かさが増します', saturn: '執着と継続を見分けていきます' },
  双子座: { lagna: '情報を集めながら入口を探します', sun: '学びと対話で世界を更新します', moon: '話して整理できると安心します', mercury: '複数の話題を素早く結びます', venus: '会話が弾む相手へ惹かれます', mars: '言葉と機転で状況を動かします', jupiter: '好奇心を共有するほど発展します', saturn: '情報を選び抜く力を育てます' },
  蟹座: { lagna: '安全な場を確かめてから関わります', sun: '守り育てる対象を人生の軸にします', moon: '親しい人との感情共有が必要です', mercury: '相手の気持ちを汲んで話します', venus: '家庭的な安心をくれる相手を選びます', mars: '大切なものを守るために動きます', jupiter: '居場所を育てるほど発展します', saturn: '感情と責任の境界を学びます' },
  獅子座: { lagna: '自分らしさが伝わる形で始めます', sun: '創造と自己表現を人生の軸にします', moon: '認められ誇りを保てると安心します', mercury: '物語と自信を持って伝えます', venus: '敬意と喜びを示す相手へ惹かれます', mars: '誇りを賭けて正面から動きます', jupiter: '人を励ますほど可能性が広がります', saturn: '評価に頼らない自信を育てます' },
  乙女座: { lagna: '必要な手順を整えてから始めます', sun: '改善と実用性を人生の軸にします', moon: '生活が整うと心も落ち着きます', mercury: '細部を確認し正確に説明します', venus: '誠実な気遣いを示す相手を選びます', mars: '問題を分解して一つずつ片づけます', jupiter: '技術を磨き人に役立てるほど伸びます', saturn: '完璧さより適切さを学びます' },
  天秤座: { lagna: '相手との釣り合いを見て進めます', sun: '公平な関係づくりを人生の軸にします', moon: '対話で均衡が戻ると安心します', mercury: '双方の論点を並べて説明します', venus: '品位と対等さのある相手を選びます', mars: '合意できる線を探して動きます', jupiter: '協力関係を広げるほど発展します', saturn: '迎合せず選ぶ力を育てます' },
  蠍座: { lagna: '表面より核心を確かめて関わります', sun: '深い変容を人生の軸にします', moon: '本音を共有できると安心します', mercury: '背景と動機まで掘って考えます', venus: '強い信頼を結べる相手を選びます', mars: '一点へ集中して状況を変えます', jupiter: '深い研究と継承によって伸びます', saturn: '執着を覚悟へ変えていきます' },
  射手座: { lagna: 'まず全体像と可能性を見ます', sun: '探究と自由を人生の軸にします', moon: '意味と見通しがあると安心します', mercury: '大きな文脈から率直に話します', venus: '成長を応援し合える相手を選びます', mars: '目標へ向かって大胆に動きます', jupiter: '学びと越境によって大きく伸びます', saturn: '理想を継続可能な信念へ育てます' },
  山羊座: { lagna: '段取りから入り続けられる形にします', sun: '積み上げた実績を人生の軸にします', moon: '先の見通しが立つと安心します', mercury: '話を具体化し結論から伝えます', venus: '約束を守る人に信頼を感じます', mars: '順番を踏み着実に押し切ります', jupiter: '経験を体系にまとめて伸びます', saturn: '責任を引き受けることで成熟します' },
  水瓶座: { lagna: '既存の前提から距離を取って始めます', sun: '独自の仕組みを人生の軸にします', moon: '自由な距離感があると安心します', mercury: '俯瞰して新しい接続を考えます', venus: '対等で個性を尊重する相手を選びます', mars: '合理的な改革へ向けて動きます', jupiter: '仲間と未来像を共有して伸びます', saturn: '理想を社会で機能する形へ育てます' },
  魚座: { lagna: '場の空気を感じながら入り口を選びます', sun: '共感と想像力を人生の軸にします', moon: '境界を緩めて休めると安心します', mercury: 'イメージや感覚を言葉にします', venus: '優しさと精神的な響きを求めます', mars: '直感に導かれて柔軟に動きます', jupiter: '受容と創造によって可能性が広がります', saturn: '共感と境界線の両立を学びます' },
}
const astroPhrase = (sign: string | undefined, role: PlanetRole) => sign && SIGN_BEHAVIOR[sign]?.[role]
  ? `${PLANET_ROLE_PREFIX[role]}${SIGN_BEHAVIOR[sign][role]}`
  : ASTRO_SIGN[sign ?? ''] ?? ''

const NAKSHATRA_DETAIL: Record<string, string> = {
  アシュヴィニー: '素早く始め、停滞を動かす力', バラニー: '責任を引き受け、最後まで変化を通過する力', クリッティカー: '不要なものを切り分け、本質を磨く力', ローヒニー: '魅力や資源を育て、形ある豊かさへつなげる力',
  ムリガシーラ: '問いを持ち続け、未知の答えを探す力', アールドラー: '混乱の中から真実を見つけ、再構築する力', プナルヴァス: '原点へ戻り、何度でも立て直す力', プシャ: '人や仕組みを養い、安定して成長させる力',
  アーシュレーシャ: '相手や状況の奥を読み、複雑さを扱う力', マガー: '受け継いだものを尊重し、自分の責任として担う力', 'プールヴァ・パールグニー': '創造性や喜びを人と分かち合う力', 'ウッタラ・パールグニー': '関係を約束と実務によって長く支える力',
  ハスタ: '技術と工夫を使い、考えを手で扱える形にする力', チトラー: '理想の像を描き、独自の美しさや構造を作る力', スヴァーティ: '自立性を保ちながら柔軟に世界を広げる力', ヴィシャーカー: '目標へ集中し、複数の可能性から一本を選ぶ力',
  アヌラーダー: '信頼と協力を育て、困難の中でも関係を守る力', ジェーシュタ: '複雑な局面で責任を担い、守るべきものを守る力', ムーラ: '表面にとらわれず、物事の根本原因まで掘る力', 'プールヴァ・アーシャーダー': '信念を掲げ、自分の価値を外へ打ち出す力',
  'ウッタラ・アーシャーダー': '長期的な原則を守り、確かな成果へ結びつける力', シュラヴァナ: 'よく聞き、知識や経験を学びとして伝える力', ダニシュター: '集団のリズムを読み、資源と行動をまとめる力', シャタビシャー: '既存の常識から距離を取り、独自に問題を解く力',
  'プールヴァ・バードラパダー': '理想を深く追い、価値観の転換を促す力', 'ウッタラ・バードラパダー': '内面の深さを保ち、静かに全体を支える力', レーヴァティー: '人や物事を安全に次の段階へ導く力',
}

const SANMEI_DETAIL: Record<string, string> = {
  貫索星: '自分の基準を守り、ひとつの方針を継続する力です。急な変更より、自分で納得した順序で進むと安定します。',
  石門星: '人と人をつなぎ、集団の中で共通点を見つける力です。対等な関係で協力すると持ち味が出ます。',
  鳳閣星: '感じたことを自然な言葉で伝え、場を和らげる力です。無理に飾らない表現ほど届きます。',
  調舒星: '繊細な感覚を独自の表現へ変える力です。一人で深く考える時間が創造性を育てます。',
  禄存星: '人を引きつけ、必要とされることで力を発揮する性質です。与えすぎない境界線も重要です。',
  司禄星: '小さな積み重ねを守り、生活や信頼を着実に育てる力です。身近な人との約束を大切にします。',
  車騎星: '迷いを行動へ切り替え、目の前の課題を突破する力です。動く前に目的を一度確認すると精度が上がります。',
  牽牛星: '役割と責任を引き受け、期待に応えようとする力です。評価だけでなく自分の納得も判断軸にすると安定します。',
  龍高星: '未知の環境へ踏み出し、経験から学ぶ力です。変化や異文化に触れるほど視野が広がります。',
  玉堂星: '知識を受け継ぎ、整理して次の人へ伝える力です。基礎を深く学ぶほど応用が利きます。',
}

const POSITION_MEANING: Record<string, string> = {
  north: '思考の癖、親・目上との関係', west: '配偶者や身近な人との関係', center: '本人の核となる性質',
  east: '友人・兄弟・社会へ向かう行動', south: '子ども・部下・未来への表現',
}

const SUBORDINATE_DETAIL: Record<string, string> = {
  天貴星: '素直に学び、周囲から育てられることで伸びるエネルギー', 天恍星: '感受性と夢を表現へ変える、揺れ幅のあるエネルギー',
  天南星: '若々しい挑戦心で前へ出る、勢いのあるエネルギー', 天禄星: '現実を守り、責任を継続して果たす安定したエネルギー',
  天将星: '自分で決断し、大きな責任を引き受ける強いエネルギー', 天堂星: '急がず状況を見渡し、経験を活かす落ち着いたエネルギー',
  天胡星: '感覚が鋭く、目に見えない機微を創作や洞察へ変えるエネルギー', 天極星: '執着を手放し、相手や環境へ柔軟に馴染むエネルギー',
  天庫星: '過去や専門知識を蓄え、ひとつのテーマを深く掘るエネルギー', 天馳星: '切り替えが速く、複数の場所や役割を軽やかに動くエネルギー',
  天報星: '変化の可能性を多く持ち、環境に合わせて姿を変えるエネルギー', 天印星: '自然に助けを受け取り、人を和ませる柔らかなエネルギー',
}

const TEN_GOD_DETAIL: Record<string, string> = {
  比肩: '自立・自己決定', 劫財: '競争・仲間との連携', 食神: '表現・おおらかさ', 傷官: '感性・改善力',
  偏財: '行動的な対人力・商才', 正財: '堅実な管理・蓄積', 偏官: '突破力・緊張感', 正官: '責任・秩序',
  偏印: '独創的な学習・転換', 正印: '知識・保護・継承', 日主: '本人自身',
}

const YEAR_DOMAIN_DETAIL: Record<string, { work: string; love: string; relation: string; caution: string }> = {
  比肩: { work: '自分の判断で進める仕事や、新しい担当を持つ機会が増えやすい年です。', love: '相手に合わせるより、自分が望む関係をはっきりさせることが進展につながります。', relation: '対等に付き合える人との縁が残り、依存的な関係とは距離が生まれやすくなります。', caution: '一人で決め切らず、重要な場面では第三者の意見も確認してください。' },
  劫財: { work: '仲間との共同作業や競争が増え、人を通じて仕事の範囲が広がりやすい年です。', love: '友人関係から恋へ進む一方、周囲の意見に関係が揺れやすい面もあります。', relation: '新しい集まりへ入る機会が増えますが、費用や役割の曖昧さには注意が必要です。', caution: '勢いで約束せず、お金と担当範囲を先に確認してください。' },
  食神: { work: '発信、企画、接客など、楽しさや分かりやすさを届ける仕事が評価されやすい年です。', love: '一緒に食事や趣味を楽しめる相手と自然に距離が縮まりやすくなります。', relation: '気楽に話せる人が増え、紹介や集まりから新しい縁が生まれやすい時期です。', caution: '楽しい予定を増やしすぎず、最後まで仕上げる時間を確保してください。' },
  傷官: { work: '改善点を見抜く力や表現力が強まり、企画の見直しや専門的な発信で注目されやすい年です。', love: '言葉の感度が上がるぶん、相手の何気ない一言を深く受け取りやすくなります。', relation: '価値観の違いがはっきりし、本音で話せる関係と無理をしていた関係が分かれます。', caution: '正しさをそのままぶつけず、要望として伝えると関係が整います。' },
  偏財: { work: '顧客、取引先、新しい人脈から仕事や収入の機会が広がりやすい年です。', love: '出会いの数が増え、行動範囲を広げるほど恋が始まりやすくなります。', relation: '人付き合いが活発になり、誘いを受ける機会も増えます。', caution: '交際費や予定を広げすぎず、本当に大切な縁へ時間を残してください。' },
  正財: { work: '収入、契約、継続案件など、成果を現実的な形へまとめやすい年です。', love: '交際を生活の一部として考えやすく、同居、婚約、結婚の具体的な話が進みやすくなります。', relation: '約束を守り合える堅実な人との関係が深まりやすい時期です。', caution: '条件だけで決めず、気持ちが置き去りになっていないかも確認してください。' },
  偏官: { work: '責任の重い依頼や短期間で結果を求められる場面が増え、行動力が試される年です。', love: '強く惹かれる相手が現れやすい一方、関係を急ぎすぎると衝突も起こりやすくなります。', relation: '頼られる場面が増えますが、無理な要求には早めに線を引く必要があります。', caution: '疲れたまま即決せず、期限と負担を確認してから引き受けてください。' },
  正官: { work: '昇進、肩書、正式な契約など、責任と評価が目に見える形になりやすい年です。', love: '曖昧な関係に結論が出やすく、正式な交際や結婚へ進む話がまとまりやすくなります。', relation: '信頼できる人や組織とのつながりが強まり、紹介にも恵まれやすい時期です。', caution: '期待に応えようとして、自分の希望まで後回しにしないでください。' },
  偏印: { work: '新しい技術や分野を学び、働き方そのものを組み替えるきっかけが生まれやすい年です。', love: 'これまで選ばなかったタイプに惹かれ、恋愛観が変わる可能性があります。', relation: '異なる業界や環境の人との交流が、新しい考え方を運んできます。', caution: '興味だけで次々に移らず、一つは形にしてから次へ進んでください。' },
  正印: { work: '学び直し、資格取得、上司や専門家からの支援が仕事の土台になりやすい年です。', love: '安心して相談できる相手との信頼が育ち、急がない関係ほど深まりやすくなります。', relation: '助言をくれる年上の人や、落ち着いて話せる人との縁が支えになります。', caution: '準備だけで満足せず、学んだことを小さく実践してください。' },
}

const ELEMENT_DETAIL: Record<string, string> = {
  木: '成長・企画・人を育てる力', 火: '表現・情熱・認知を広げる力', 土: '安定・管理・現実化する力',
  金: '判断・品質・不要なものを整える力', 水: '知恵・柔軟性・情報をつなぐ力',
}

const LOVE_STYLE: Record<string, string> = {
  貫索星: '距離を急に縮めるより、互いの生活と価値観を尊重しながら信頼を育てるタイプ',
  石門星: '友達のように何でも話せる対等さから、恋愛関係を深めるタイプ',
  鳳閣星: '自然体で一緒に楽しめること、穏やかな会話を大切にするタイプ',
  調舒星: '表面的な条件より感性の一致を重視し、深く繊細につながるタイプ',
  禄存星: '愛情を行動で与え、相手から必要とされることで絆を感じるタイプ',
  司禄星: '日常の安心、約束、生活の積み重ねによって愛情を確かめるタイプ',
  車騎星: '好意が行動に出やすく、率直でテンポのよい関係を好むタイプ',
  牽牛星: '責任感が強く、仕事や社会的役割を背負える、礼儀と誇りのある芯の強いタイプ',
  龍高星: '互いの自由や挑戦を認め、新しい経験を共有したいタイプ',
  玉堂星: '落ち着いた会話と精神的な理解を重ね、安心を育てるタイプ',
}

const WORK_STYLE: Record<string, string> = {
  貫索星: '専門性を磨き、自分の裁量で一貫して進める働き方', 石門星: '人をつなぎ、チームの合意をつくる働き方',
  鳳閣星: '情報や魅力をわかりやすく伝える働き方', 調舒星: '独自の感性や問題意識を企画・表現へ変える働き方',
  禄存星: '顧客や周囲のニーズを捉え、価値を提供する働き方', 司禄星: '運用・管理・改善を積み重ねる働き方',
  車騎星: '現場で素早く動き、課題を突破する働き方', 牽牛星: '責任範囲を明確にし、品質と信用を守る働き方',
  龍高星: '新分野を開拓し、変化の中で学び続ける働き方', 玉堂星: '知識を蓄え、教える・伝承する働き方',
}

const LIFE_PATH: Record<number, string> = {
  1: '自分で始めること', 2: '人をつなぎ調和をつくること', 3: '喜びや発想を表現すること', 4: '確かな仕組みを築くこと',
  5: '変化を経験し自由を広げること', 6: '愛情と責任で場を整えること', 7: '本質を探究し知恵を深めること', 8: '現実的な成果と影響力を扱うこと',
  9: '広い視野で人や社会に還元すること', 11: '直感を言葉や創造へ変えること', 22: '大きな構想を現実の仕組みにすること', 33: '包容力を通して人を癒やし育てること',
}

const SUKUYO_DETAIL: Record<string, string> = {
  婁: '観察力と実務感覚で、細部を整えながら信頼を築く宿', 胃: '目標へ向かう意欲が強く、現実的な成果を取りにいく宿', 昴: '品位と美意識を備え、人から注目されやすい宿',
  畢: '粘り強く基盤を守り、時間をかけて完成させる宿', 觜: '言葉と分析に優れ、交渉や説明で力を発揮する宿', 参: '好奇心と行動力が強く、新しい環境を切り開く宿',
  井: '秩序と公平性を重視し、集団の仕組みを整える宿', 鬼: '感受性と奉仕性が高く、人の気持ちを支える宿', 柳: '情熱と集中力が強く、感情を創造へ変える宿',
  星: '自尊心と統率力を持ち、自分の役割を堂々と果たす宿', 張: '華やかな表現力と社交性で、人を引きつける宿', 翼: '理想と慎重さを併せ持ち、長期的に信用を育てる宿',
  軫: '対話と移動によって情報をつなぎ、状況へ柔軟に適応する宿', 角: '独立心と先駆性を持ち、新しい流れを始める宿', 亢: '正義感と責任感が強く、筋道を守ろうとする宿',
  氐: '逆境への耐久力があり、現実を立て直す力を持つ宿', 房: '愛情と包容力が豊かで、人との縁を育てる宿', 心: '洞察力と魅力を備え、相手の本音や場の機微を読む宿',
  尾: '一つのことを深く追い、最後までやり抜く宿', 箕: '自由と率直さを重視し、広い世界へ動く宿', 斗: '戦略性と管理力を持ち、先を見て資源を配分する宿',
  女: '規律と堅実さを大切にし、日常を正確に守る宿', 虚: '精神性と想像力が高く、目に見えない価値を探る宿', 危: '独創性と変化への感度を持ち、既成概念を越える宿',
  室: '蓄積と保護の力が強く、安心できる領域を築く宿', 壁: '学習と伝承を重視し、知識で人を支える宿', 奎: '美意識と言語感覚に優れ、文化や表現を磨く宿',
}

const KYUSEI_DETAIL: Record<string, string> = {
  一白水星: '柔軟性・秘密・人脈。環境に浸透しながら機会をつかむ', 二黒土星: '育成・継続・受容。地道な積み重ねで土台を作る', 三碧木星: '始動・発言・スピード。新しい流れを素早く起こす',
  四緑木星: '信用・調整・遠方との縁。対話で人と情報をつなぐ', 五黄土星: '中心性・再生・影響力。責任を引き受け状況を動かす', 六白金星: '決断・規律・統率。高い基準で物事を完成へ導く',
  七赤金星: '会話・喜び・商才。人が集まる場で価値を循環させる', 八白土星: '継承・転換・蓄積。節目で仕組みを作り替える', 九紫火星: '知性・評価・美意識。物事を明らかにして魅力を伝える',
}

const NUMEROLOGY_DETAIL: Record<number, string> = {
  1: '主体性と開始', 2: '協調と感受性', 3: '表現と創造性', 4: '秩序と継続', 5: '変化と自由', 6: '愛情と責任', 7: '探究と内省', 8: '成果と経営', 9: '統合と奉仕',
  11: '直感と啓発', 22: '大きな構想の現実化', 33: '無条件の包容と育成',
}

const NAYIN_DETAIL: Record<string, string> = {
  海中金: '海中に眠る金。価値を内側で育て、時機を待って形にする', 炉中火: '炉の火。集中と鍛錬によって素材を変化させる', 大林木: '広い森林。人や企画を育て、長期的な広がりを作る',
  路旁土: '道を支える土。生活や組織の基盤を実務で整える', 剣鋒金: '刃先の金。判断力を磨き、曖昧さを切り分ける', 山頭火: '山上の火。遠くまで届く目標や理念を掲げる',
  涧下水: '谷間の水。細い流れから知識や縁をつないでいく', 城頭土: '城壁の土。境界線と責任範囲を守る', 白蜡金: '精製途中の金。経験と技術によって完成度を高める',
  楊柳木: 'しなやかな柳。環境へ適応しながら折れずに伸びる', 泉中水: '湧き出る泉。内側の知恵や感性を人へ届ける', 屋上土: '屋根を覆う土。人の暮らしや安心を保護する',
  霹靂火: '雷の火。停滞を一気に破り、状況を転換させる', 松柏木: '常緑の木。逆境でも原則を守り、長く継続する', 長流水: '大きく続く水。情報や経験を絶えず循環させる',
  砂中金: '砂中の金。多くの選択肢から本当に価値あるものを選ぶ', 山下火: '山麓の火。身近な場を照らし、実用的な熱を届ける', 平地木: '平地に育つ木。協力できる環境で可能性を大きく広げる',
  壁上土: '壁の土。役割や仕組みを明確にし、場を守る', 金箔金: '薄く輝く金。美意識や見せ方によって価値を高める', 覆燈火: '灯火。小さくても必要な場所を継続して照らす',
  天河水: '天上の川。大きな発想や理想を現実へ降ろす', 大駅土: '往来を支える土。人と資源が動く拠点を整える', 釵釧金: '装飾の金。洗練と対人感覚で魅力を形にする',
  桑柘木: '暮らしを支える木。役立つ技能や成果を着実に育てる', 大溪水: '渓谷の大水。変化の中で道を切り開き、流れを作る', 沙中土: '砂の中の土。柔軟に形を変えながら足場を固める',
  天上火: '天の火。広い視野と影響力で周囲を明るくする', 石榴木: '実を結ぶ木。内に蓄えた力を成果として結実させる', 大海水: '大海の水。多様性を受け入れ、大きな可能性を包む',
}

export function buildDeterministicReport(input: ReportInput): string {
  const identityKey = [
    input.birthDate, input.birthTime || 'time-unknown', input.birthplace, input.gender,
    input.shichuDay, input.nayin, input.sanmeiStar, input.sukuyo, input.lifePathNumber,
    input.honmeiName, input.numerologyProfile?.birthDayNumber, input.numerologyProfile?.attitudeNumber,
    input.sanmeiChart ? Object.values(input.sanmeiChart.bodyChart).map(item => item.star).join('') : '',
  ].join('|')
  const stableHash = (value: string) => [...value].reduce((hash, char) => ((hash * 31) + (char.codePointAt(0) ?? 0)) >>> 0, 2166136261)
  const pick = <T>(items: readonly T[], salt: string) => items[stableHash(`${identityKey}|${salt}`) % items.length]
  const rotate = <T>(items: T[], salt: string) => {
    if (items.length < 2) return items
    const offset = stableHash(`${identityKey}|${salt}`) % items.length
    return [...items.slice(offset), ...items.slice(0, offset)]
  }
  const day = DAY_STEM[input.shichuDay[0]] ?? DAY_STEM.甲
  const sanmei = SANMEI[input.sanmeiStar] ?? '資質を着実に活かす力'
  const mission = LIFE_PATH[input.lifePathNumber] ?? LIFE_PATH[1]
  const sukuyoDetail = SUKUYO_DETAIL[input.sukuyo] ?? '本命宿の性質を、対人関係と行動傾向の補助線として読みます'
  const nayinDetail = NAYIN_DETAIL[input.nayin] ?? '干支の組み合わせを自然界のイメージへ置き換えた分類です'
  const honmeiDetail = KYUSEI_DETAIL[input.honmeiName] ?? '社会で繰り返しやすい行動パターンを表します'
  const pillarDetail = input.fourPillars?.map(pillar => {
    const tenGodMeaning = TEN_GOD_DETAIL[pillar.stemTenGod] ?? '命式全体を補う性質'
    return `${pillar.label}${pillar.kanshi}：表に出やすい通変星は${pillar.stemTenGod}（${tenGodMeaning}）。内側には${pillar.hiddenStems.map(item => `${item.stem}の${item.tenGod}`).join('、')}を持ちます。`
  }).join('\n') ?? '出生データから詳細命式を算出できませんでした。'
  const elementDetail = input.elementBalance
    ? Object.entries(input.elementBalance.scores).map(([element, score]) => `${element}${score}`).join('・')
    : '算出なし'
  const bodyChartDetail = input.sanmeiChart
    ? Object.entries(input.sanmeiChart.bodyChart).map(([position, item]) =>
        `${item.label}の${item.star}：${POSITION_MEANING[position] ?? 'この場所での表れ方'}では、${SANMEI_DETAIL[item.star] ?? SANMEI[item.star] ?? '固有の性質が表れます。'}`
      ).join('\n')
    : '算出なし'
  const subordinateDetail = input.sanmeiChart
    ? Object.values(input.sanmeiChart.subordinateStars).map(item =>
        `${item.label}は${item.star}（十二運：${item.stage}）。${SUBORDINATE_DETAIL[item.star] ?? 'その時期の環境に適応するエネルギー'}です。`
      ).join('\n')
    : '算出なし'
  const sortedElements = input.elementBalance
    ? Object.entries(input.elementBalance.scores).sort((a, b) => b[1] - a[1])
    : []
  const strongestElement = sortedElements[0]?.[0] ?? '算出なし'
  const weakestElement = sortedElements.at(-1)?.[0] ?? '算出なし'
  const bodyChart = input.sanmeiChart?.bodyChart
  const subordinateStars = input.sanmeiChart?.subordinateStars
  const westStar = bodyChart?.west?.star ?? input.sanmeiStar
  const eastStar = bodyChart?.east?.star ?? input.sanmeiStar
  const southStar = bodyChart?.south?.star ?? input.sanmeiStar
  const northStar = bodyChart?.north?.star ?? input.sanmeiStar
  const earlyStar = subordinateStars?.early
  const middleStar = subordinateStars?.middle
  const lateStar = subordinateStars?.late
  const age = input.age
  const currentPhase = age === undefined ? middleStar : age < 30 ? earlyStar : age < 60 ? middleStar : lateStar
  const currentPhaseLabel = age === undefined ? '現在' : `${age}歳現在（人生段階は30年ごとの目安）`
  const currentYear = new Date().getFullYear()
  const decadeDetail = input.timing?.decades.map(period =>
    `**${period.startYear}〜${period.endYear}年（約${period.startAge}〜${period.endAge}歳）${period.kanshi}・${period.tenGod}：** ${period.themes.join('、')}`
  ).join('\n') ?? '出生データから大運を算出できませんでした。'
  const marriageDetail = input.timing?.marriageCandidates.map(item =>
    `**${item.year}年（${item.ageRange}）${item.kanshi}：** ${item.relationshipSignals.join('、')}。${item.themes.join('、')}が重なる候補年です。`
  ).join('\n') || '単独で強く重なる候補年はありません。大運の切り替わりと実際の出会い・関係性を合わせて判断してください。'
  const nearbyAnnual = input.timing?.annual.filter(item => item.year >= currentYear - 3 && item.year <= currentYear + 8) ?? []
  const annualDetail = nearbyAnnual.map(item => {
    const relationship = item.relationshipSignals.length ? ` 恋愛・結婚面では${item.relationshipSignals.join('、')}。` : ''
    return `**${item.year}年（${item.ageRange}）${item.kanshi}・${item.tenGod}：** ${item.themes.join('、')}。${relationship}`
  }).join('\n') || '近年の年運を算出できませんでした。'
  const sanmeiRelationDetail = input.sanmeiRelations?.relations.length
    ? input.sanmeiRelations.relations.map(item => `**${item.pillars}の${item.branches}・${item.relation}：** ${item.meaning}`).join('\n')
    : '命式内に六合・冲・害・刑の強い重なりはありません。'
  const tenchuAffected = input.sanmeiRelations?.affectedPillars.length
    ? input.sanmeiRelations.affectedPillars.join('・')
    : '命式の年支・月支・日支・時支には直接該当しません'
  const ziweiPalaceDetail = input.ziwei?.available
    ? input.ziwei.palaces?.slice().sort((a, b) => (a.name === '命宮' ? -1 : b.name === '命宮' ? 1 : 0)).filter(palace => (palace.decadal.range?.[0] ?? 0) < 85).map(palace => {
        const major = palace.majorStars.length
          ? palace.majorStars.map(star => `${star.name}${star.brightness ? `（${star.brightness}）` : ''}${star.mutagen ? `・化${star.mutagen}` : ''}：${star.detail}`).join('／')
          : '主星なし（対宮と三方四正を合わせて読みます）'
        const minor = palace.minorStars.slice(0, 4).join('・') || 'なし'
        return `**${palace.name}${palace.isBodyPalace ? '［身宮］' : ''}（${palace.heavenlyStem}${palace.earthlyBranch}）：** ${major}。主な補助星は${minor}。大限${palace.decadal.range?.join('〜') ?? '算出なし'}歳。`
      }).join('\n') + '\n85歳以降の大限は、初期表示では省略しています。'
    : input.ziwei?.reason ?? '出生時刻がないため算出できません。'
  const ziweiPalaces = input.ziwei?.available ? input.ziwei.palaces ?? [] : []
  const palaceStars = (name: string) => {
    const palace = ziweiPalaces.find(item => item.name === name)
    return palace?.majorStars.length
      ? palace.majorStars.map(star => `${star.name}${star.mutagen ? `（化${star.mutagen}）` : ''}`).join('・')
      : '主星なし（対宮・三方四正を参照）'
  }
  const soulPalaceStars = palaceStars('命宮')
  const careerPalaceStars = palaceStars('官祿')
  const wealthPalaceStars = palaceStars('財帛')
  const couplePalaceStars = palaceStars('夫妻')
  const healthPalaceStars = palaceStars('疾厄')
  const homePalaceStars = palaceStars('田宅')
  const friendsPalaceStars = palaceStars('僕役')
  const parentsPalaceStars = palaceStars('父母')
  const currentDecade = input.timing?.decades.find(period => currentYear >= period.startYear && currentYear <= period.endYear)
  const currentAnnual = input.timing?.annual.find(item => item.year === currentYear)
  const currentTimingSummary = [
    currentDecade ? `大運${currentDecade.kanshi}・${currentDecade.tenGod}（${currentDecade.themes.join('、')}）` : '',
    currentAnnual ? `${currentYear}年${currentAnnual.kanshi}・${currentAnnual.tenGod}（${currentAnnual.themes.join('、')}）` : '',
    input.numerologyProfile ? `個人年${input.numerologyProfile.personalYearNumber}（${NUMEROLOGY_DETAIL[input.numerologyProfile.personalYearNumber] ?? '一年のテーマ'}）` : '',
  ].filter(Boolean).join('、')
  const currentTimingThemes = [...new Set([
    ...(currentDecade?.themes ?? []),
    ...(currentAnnual?.themes ?? []),
  ])].join('、')
  const western = input.astrology?.western
  const vedic = input.astrology?.vedic
  const westernPlanet = (name: string) => western?.planets.find(planet => planet.name === name)
  const vedicPlanet = (name: string) => vedic?.planets.find(planet => planet.name === name)
  const planetLine = (planets: NonNullable<typeof western>['planets'], system: '西洋／トロピカル' | 'インド／サイデリアル') => planets.map(planet =>
    `${planet.name}：${planet.sign}${planet.degree.toFixed(1)}°${planet.retrograde ? '（逆行）' : ''}（${system}）`
  ).join('／')
  const westernSun = westernPlanet('太陽')
  const westernMoon = westernPlanet('月')
  const westernMercury = westernPlanet('水星')
  const westernVenus = westernPlanet('金星')
  const westernMars = westernPlanet('火星')
  const westernJupiter = westernPlanet('木星')
  const westernSaturn = westernPlanet('土星')
  const vedicSun = vedicPlanet('太陽')
  const vedicMoon = vedicPlanet('月')
  const vedicMercury = vedicPlanet('水星')
  const vedicVenus = vedicPlanet('金星')
  const vedicMars = vedicPlanet('火星')
  const vedicJupiter = vedicPlanet('木星')
  const vedicSaturn = vedicPlanet('土星')
  const wholeSignHouse = (sign: string | undefined) => {
    if (!sign || !western?.ascendant.sign) return null
    const ascIndex = ZODIAC_SIGNS.indexOf(western.ascendant.sign)
    const signIndex = ZODIAC_SIGNS.indexOf(sign)
    return ascIndex < 0 || signIndex < 0 ? null : ((signIndex - ascIndex + 12) % 12) + 1
  }
  const sunHouse = wholeSignHouse(westernSun?.sign)
  const moonHouse = wholeSignHouse(westernMoon?.sign)
  const saturnHouse = wholeSignHouse(westernSaturn?.sign)

  type ConsensusKey = 'initiative' | 'communication' | 'insight' | 'stability' | 'independence' | 'harmony' | 'responsibility' | 'transformation' | 'creativity' | 'care' | 'exploration' | 'practicality'
  const consensusLabels: Record<ConsensusKey, { title: string; summary: string; work: string; love: string; action: string }> = {
    initiative: { title: '自分から始める力', summary: '受け身で待つより、自分で最初の一歩を決めたときに流れが生まれます。', work: '新しい企画や改善を立ち上げ、最初の形を作る役割', love: '遠回しに待つより、希望を率直に伝えられる関係', action: '小さくても自分で開始日を決める' },
    communication: { title: '言葉と情報をつなぐ力', summary: '複雑な情報や人の考えを整理し、伝わる形へ変える力があります。', work: '企画、編集、発信、教育、調整など言葉を価値に変える役割', love: '察し合うだけでなく、考えや不安を言葉で確認できる関係', action: '判断理由を短い文章にして共有する' },
    insight: { title: '表面の奥を読む洞察力', summary: '人や状況の小さな変化を捉え、見えにくい原因まで考える傾向があります。', work: '分析、研究、相談支援、戦略など深く掘る役割', love: '本音を推測だけで決めず、安心して確認できる関係', action: '事実・解釈・希望を分けて整理する' },
    stability: { title: '積み重ねて安定させる力', summary: '一時的な勢いより、生活・信頼・技術を継続して育てる力があります。', work: '運用、管理、育成、品質改善など継続が成果になる役割', love: '約束や生活感覚を大切にし、安心を積み上げられる関係', action: '続ける習慣を一つだけ固定する' },
    independence: { title: '自分の基準を守る力', summary: '周囲に流されず、納得できる方法と距離感を選ぶことで力を発揮します。', work: '裁量があり、専門性を自分の方法で磨ける役割', love: '互いの自由と一人の時間を尊重できる関係', action: '譲れる条件と譲れない条件を一つずつ決める' },
    harmony: { title: '人と人を調整する力', summary: '異なる立場の共通点を見つけ、関係を滑らかに整える力があります。', work: '顧客対応、交渉、チーム連携、パートナー支援の役割', love: '対等に話し合い、二人の落とし所を作れる関係', action: '相手の希望と自分の希望を両方言語化する' },
    responsibility: { title: '責任を現実へ変える力', summary: '任されたことを形にし、長期的な結果へつなげる力があります。', work: '管理、経営、専門職など基準と責任が明確な役割', love: '将来、金銭、生活分担を具体的に話せる関係', action: '責任の範囲と終了条件を先に決める' },
    transformation: { title: '変化を再構築へつなげる力', summary: '古い前提を見直し、状況をより本質的な形へ作り直す力があります。', work: '改革、再設計、危機対応、新規事業など変化を扱う役割', love: '変化や本音を恐れず、関係を更新できる相手', action: '手放すものと残すものを明確にする' },
    creativity: { title: '独自の形を生み出す力', summary: '感覚や理想を、自分らしい表現や構造へ変える力があります。', work: 'デザイン、文章、企画、ブランドなど独自性を形にする役割', love: '感性や価値観を否定せず、互いに刺激を与えられる関係', action: '完成前でも一度外へ見せて反応を得る' },
    care: { title: '人や場を育てる力', summary: '相手が安心して力を出せる環境を作り、必要なものを整える力があります。', work: '育成、支援、接客、コミュニティ運営など人を支える役割', love: '与えるだけでなく、自分も安心して頼れる関係', action: '助ける範囲と休む時間を決める' },
    exploration: { title: '世界を広げる探究心', summary: '未知の知識や環境に触れ、可能性を広げることで成長します。', work: '研究、海外、教育、IT、メディアなど学び続ける役割', love: '互いの成長や新しい経験を応援できる関係', action: '今月試す新しい経験を一つ選ぶ' },
    practicality: { title: '考えを現実の形にする力', summary: '抽象的な考えを手順・数字・成果物へ落とし込むことで強みが完成します。', work: '実務設計、運営、財務、制作など成果が確認できる役割', love: '気持ちだけでなく、行動と生活設計で信頼を示す関係', action: '次の行動を期限と数値で決める' },
  }
  const sectionLabels: Record<ConsensusKey, { destiny: string; work: string; love: string; friend: string; shadow: string }> = {
    initiative: { destiny: 'まだない流れを起こす', work: '企画を立ち上げて最初の形を作る', love: '好意と希望を率直に示す', friend: '新しい体験を一緒に始める', shadow: '先に走りすぎると' },
    communication: { destiny: '複雑さを翻訳して届ける', work: '企画・編集・説明で価値を作る', love: '言葉で安心を確認する', friend: '会話と知的刺激を共有する', shadow: '情報を扱いすぎると' },
    insight: { destiny: '見過ごされた原因を見つける', work: '分析と研究で本質を掘る', love: '推測せず本音を確かめる', friend: '少人数で深く理解し合う', shadow: '深読みが過ぎると' },
    stability: { destiny: '時間を味方にして育てる', work: '運用と改善を継続する', love: '約束と日常を積み重ねる', friend: '長く続く信頼を選ぶ', shadow: '安定を守りすぎると' },
    independence: { destiny: '自分の基準を作る', work: '裁量と専門性を確保する', love: '自由と距離感を尊重する', friend: '互いの世界を守って付き合う', shadow: '一人で抱えすぎると' },
    harmony: { destiny: '異なる立場の接点を作る', work: '利害を整理して合意を作る', love: '対等な落とし所を探す', friend: '違いを尊重して場を整える', shadow: '周囲を優先しすぎると' },
    responsibility: { destiny: '理想を続けられる仕組みにする', work: '完了条件を定めて仕上げる', love: '将来と生活を具体化する', friend: '助ける範囲を決めて支える', shadow: '責任を背負いすぎると' },
    transformation: { destiny: '古い前提を次の形へ更新する', work: '改革と再設計を担う', love: '変化を話し合って関係を更新する', friend: '転機を支え合う', shadow: '変化を急ぎすぎると' },
    creativity: { destiny: '内側の感覚を作品へ変える', work: '独自性を企画や表現にする', love: '感性を否定せず刺激し合う', friend: '作品と価値観を共有する', shadow: '完成を求めすぎると' },
    care: { destiny: '人が育つ環境を整える', work: '支援と育成で力を引き出す', love: '与えるだけでなく頼り合う', friend: '安心できる居場所を作る', shadow: '世話を引き受けすぎると' },
    exploration: { destiny: '未知を学び可能性を広げる', work: '学びを専門性へ変える', love: '互いの成長と挑戦を応援する', friend: '違う世界から刺激を受ける', shadow: '可能性を広げすぎると' },
    practicality: { destiny: '抽象を使える方法へ落とす', work: '手順・数字・成果物に変える', love: '行動と生活設計で信頼を示す', friend: '口約束より行動で助け合う', shadow: '効率を優先しすぎると' },
  }
  const friendTendencies: Record<ConsensusKey, string> = {
    initiative: '一緒に新しいことを始められ、率直に刺激し合える友人を求めます。停滞した関係からは自然に距離ができます。', communication: '会話のテンポと情報交換を重視します。話題が豊富で、考えを言葉にできる相手と友情が続きます。', insight: '広く浅い関係より、本音や背景まで話せる少人数との深い友情を好みます。',
    stability: '頻繁に会わなくても約束を守り、長く付き合える友人を大切にします。', independence: '常に一緒にいる関係より、互いの世界と距離感を尊重できる友情が合います。', harmony: 'グループの空気を読み、対立を調整する役になりやすい一方、我慢のしすぎには注意が必要です。',
    responsibility: '頼られると力を貸しますが、友人の問題まで背負わない境界線が必要です。', transformation: '人生の転換期に現れる友人から大きな影響を受けます。古い関係を無理に維持する必要はありません。', creativity: '感性や作品、独自の価値観を共有できる友人との交流が活力になります。',
    care: '相談を受ける側になりやすく、安心できる居場所を作ります。自分から助けを求めることも友情の一部です。', exploration: '異なる業界・地域・文化の友人が視野を広げます。学びを共有できる関係が長続きします。', practicality: '口約束より、行動で助け合える現実的な友情を信頼します。',
  }
  const shadowTendencies: Record<ConsensusKey, string> = {
    initiative: '結論や開始を急ぎ、周囲の準備を待てなくなること', communication: '情報を増やしすぎて、本当に伝えるべき結論がぼやけること', insight: '相手の気持ちを読みすぎ、確認前に答えを決めてしまうこと', stability: '慣れた方法を守るため、必要な変化まで遅らせること',
    independence: '一人で抱え込み、助けを求める時期が遅くなること', harmony: '関係を壊さないために、自分の希望を後回しにすること', responsibility: '自分の担当範囲を越えて責任を背負うこと', transformation: '変えること自体が目的になり、残す価値まで切ってしまうこと',
    creativity: '理想の完成形を求め、途中段階を外へ出せなくなること', care: '与えることに偏り、疲れや不満へ気づくのが遅れること', exploration: '可能性を広げすぎ、ひとつを完成させる前に次へ移ること', practicality: '正解や効率を重視しすぎ、感情の処理を後回しにすること',
  }
  const destinyTendencies: Record<ConsensusKey, string> = {
    initiative: 'まだ形のないものに最初の動きを与えること', communication: '複雑なものを理解し、人へ届く言葉に翻訳すること', insight: '見過ごされている原因や本音を見つけ、理解へ導くこと', stability: '人・技術・信頼を時間をかけて育てること',
    independence: '既存の型に合わせるだけでなく、自分の基準を作ること', harmony: '違う立場の人をつなぎ、双方が続けられる関係を作ること', responsibility: '理想を責任ある仕組みや成果へ変えること', transformation: '終わった仕組みを見直し、次に必要な形へ再構築すること',
    creativity: '内側の感覚や理想を、他者が触れられる表現へ変えること', care: '人が安心して育つ環境を整えること', exploration: '未知の世界を学び、得た知識を次の可能性へつなぐこと', practicality: '抽象的な考えを、実際に使える方法と成果へ落とし込むこと',
  }
  const dailyTendencies: Record<ConsensusKey, string> = {
    initiative: '納得した瞬間の初動が速く、誰かの許可を待つより自分で試作品を作ると力が出ます。反面、周囲との速度差が大きいと孤立感を持ちやすいため、開始前に目的だけ共有すると進みやすくなります。',
    communication: '頭の中では複数の情報を同時につなげています。会話・文章・図解などで外に出すと考えが整理され、周囲にも価値が伝わります。曖昧な空気を読み続けるより、言葉で確認できる状況の方が安心できます。',
    insight: '表情、言葉の間、状況の矛盾など、他の人が見逃す細部を自然に拾います。深く理解できる反面、まだ確認していない相手の本音まで推測しやすいため、観察した事実と自分の解釈を分けることが重要です。',
    stability: '派手な一発より、毎日の改善と信用の蓄積によって後から大きな差を作ります。急な変更には慎重ですが、変える理由と手順が明確なら粘り強く移行できます。',
    independence: '自分なりの基準と集中できる時間が必要です。人を拒むというより、まず一人で考えてから関わることで質の高い判断ができます。助けを借りる基準を事前に決めると抱え込みを防げます。',
    harmony: '相手ごとの事情を理解し、双方が受け入れられる着地点を探します。場を整える能力が高い一方、表面上の平和のために本音を飲み込むと後から疲れが出るため、自分の条件も同じ重さで扱う必要があります。',
    responsibility: '頼まれたことを曖昧なままにせず、完了まで持っていこうとします。信用につながる長所ですが、期待を先回りして担当外まで背負いやすいため、役割・期限・完成条件を明文化すると能力が安定します。',
    transformation: '違和感のある仕組みをそのまま受け入れず、根本から組み替える発想があります。転機では思い切った選択ができますが、全部を一度に変えず、残す資産を決めてから動くほど成果につながります。',
    creativity: '既存の正解をなぞるより、感覚や経験を自分らしい表現へ変えると評価されます。完成度を高める力と未完成を見せる勇気を両立すると、才能が仕事や縁につながります。',
    care: '人が困っている箇所を早く察し、安心して動けるよう環境を整えます。必要とされることが喜びになりやすい一方、与える量と受け取る量が偏らない関係を選ぶことが大切です。',
    exploration: '未知の知識、人、場所との出会いが停滞を破ります。興味の幅は強みですが、学んだ内容を一つの成果物にまとめる期限を置くと、経験が確かな専門性になります。',
    practicality: '理想論だけで終わらせず、手順・予算・期限へ落とすことで安心します。現実性は大きな強みですが、数字に表れにくい感情や納得感も判断材料として残すと選択の後悔が減ります。',
  }
  const signals = new Map<ConsensusKey, Set<string>>()
  const addSignals = (source: string, keys: ConsensusKey[]) => keys.forEach(key => {
    if (!signals.has(key)) signals.set(key, new Set())
    signals.get(key)!.add(source)
  })
  const signSignals: Record<string, ConsensusKey[]> = {
    牡羊座: ['initiative', 'independence'], 牡牛座: ['stability', 'practicality'], 双子座: ['communication', 'exploration'], 蟹座: ['care', 'stability'], 獅子座: ['creativity', 'initiative'], 乙女座: ['practicality', 'insight'],
    天秤座: ['harmony', 'communication'], 蠍座: ['insight', 'transformation'], 射手座: ['exploration', 'initiative'], 山羊座: ['responsibility', 'practicality'], 水瓶座: ['independence', 'transformation'], 魚座: ['insight', 'care'],
  }
  const stemSignals: Record<string, ConsensusKey[]> = { 甲: ['initiative', 'exploration'], 乙: ['harmony', 'care'], 丙: ['creativity', 'initiative'], 丁: ['insight', 'creativity'], 戊: ['stability', 'responsibility'], 己: ['care', 'practicality'], 庚: ['transformation', 'initiative'], 辛: ['practicality', 'insight'], 壬: ['exploration', 'communication'], 癸: ['insight', 'care'] }
  const sanmeiSignals: Record<string, ConsensusKey[]> = { 貫索星: ['independence', 'stability'], 石門星: ['harmony', 'communication'], 鳳閣星: ['communication', 'creativity'], 調舒星: ['insight', 'creativity'], 禄存星: ['care', 'harmony'], 司禄星: ['stability', 'practicality'], 車騎星: ['initiative', 'transformation'], 牽牛星: ['responsibility', 'practicality'], 龍高星: ['exploration', 'transformation'], 玉堂星: ['insight', 'communication'] }
  const numberSignals: Record<number, ConsensusKey[]> = { 1: ['initiative', 'independence'], 2: ['harmony', 'care'], 3: ['creativity', 'communication'], 4: ['stability', 'practicality'], 5: ['exploration', 'transformation'], 6: ['care', 'responsibility'], 7: ['insight', 'independence'], 8: ['responsibility', 'practicality'], 9: ['care', 'insight'], 11: ['insight', 'communication'], 22: ['responsibility', 'practicality'], 33: ['care', 'creativity'] }
  addSignals('四柱推命', stemSignals[input.shichuDay[0]] ?? [])
  addSignals('算命学', sanmeiSignals[input.sanmeiStar] ?? [])
  addSignals('数秘術', numberSignals[input.lifePathNumber] ?? [])
  if (westernSun) addSignals('西洋占星術', signSignals[westernSun.sign] ?? [])
  if (westernMoon) addSignals('西洋占星術', signSignals[westernMoon.sign] ?? [])
  if (vedic) addSignals('インド占星術', signSignals[vedic.ascendant.sign] ?? [])
  if (vedicMoon) addSignals('インド占星術', signSignals[vedicMoon.sign] ?? [])
  if (/五黄|八白|六白/.test(input.honmeiName)) addSignals('九星気学', ['responsibility', 'practicality'])
  if (/一白|四緑/.test(input.honmeiName)) addSignals('九星気学', ['communication', 'harmony'])
  if (/三碧|九紫/.test(input.honmeiName)) addSignals('九星気学', ['initiative', 'creativity'])
  if (/二黒/.test(input.honmeiName)) addSignals('九星気学', ['care', 'stability'])
  if (/七赤/.test(input.honmeiName)) addSignals('九星気学', ['communication', 'creativity'])
  if (/天機|巨門|太陽|太陰/.test(soulPalaceStars)) addSignals('紫微斗数', ['communication', 'insight'])
  if (/紫微|天府|天梁|武曲/.test(soulPalaceStars)) addSignals('紫微斗数', ['responsibility', 'stability'])
  if (/破軍|七殺|廉貞|貪狼/.test(soulPalaceStars)) addSignals('紫微斗数', ['transformation', 'initiative'])
  const sukuyoSignals: ConsensusKey[] = []
  if (/洞察|本音|機微|直感|精神/.test(sukuyoDetail)) sukuyoSignals.push('insight')
  if (/魅力|社交|人間関係|協調|縁/.test(sukuyoDetail)) sukuyoSignals.push('harmony')
  if (/行動|挑戦|開拓|決断/.test(sukuyoDetail)) sukuyoSignals.push('initiative')
  if (/創造|表現|美|芸術/.test(sukuyoDetail)) sukuyoSignals.push('creativity')
  if (/安定|堅実|継続|守/.test(sukuyoDetail)) sukuyoSignals.push('stability')
  if (/学|探究|知識|未知/.test(sukuyoDetail)) sukuyoSignals.push('exploration')
  addSignals('宿曜', [...new Set(sukuyoSignals)])
  type Lineage = ConsensusFamily
  const sourceLineage: Record<string, Lineage> = {
    四柱推命: 'stems', 算命学: 'stems', 紫微斗数: 'stems', 西洋占星術: 'ephemeris', インド占星術: 'ephemeris',
    数秘術: 'number', 九星気学: 'number', 宿曜: 'lunar',
  }
  const lineageName: Record<Lineage, string> = { stems: '干支系', ephemeris: '天体系', number: '数理系', lunar: '宿曜系' }
  const familySystems: Record<Lineage, string[]> = {
    stems: ['四柱推命', '算命学', '紫微斗数'],
    ephemeris: ['西洋占星術', 'インド占星術'],
    number: ['数秘術', '九星気学'],
    lunar: ['宿曜'],
  }
  const { items: consensusItems, splitVerdicts } = buildTwoStageConsensus(signals, sourceLineage, familySystems)
  const rankedConsensus = consensusItems
    .filter(item => item.lineageCount >= 2)
    .sort((a, b) => b.lineageCount - a.lineageCount || b.score - a.score || b.count - a.count || a.key.localeCompare(b.key))
  const supportingConsensus = consensusItems
    .filter(item => item.lineageCount < 2 || !rankedConsensus.includes(item))
    .sort((a, b) => b.lineageCount - a.lineageCount || b.score - a.score || b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 5)
  // 一致条件は常に2系統以上。件数を揃えるために閾値を下げない。
  const selectedConsensus = rankedConsensus.slice(0, 3)
  const strongest = selectedConsensus[0]
  const sourceFactor = (source: string) => {
    if (source === '四柱推命') return `日柱 ${input.shichuDay}`
    if (source === '算命学') return `中心星 ${input.sanmeiStar}`
    if (source === '紫微斗数') return `命宮 ${soulPalaceStars}／官禄宮 ${careerPalaceStars}`
    if (source === '西洋占星術') return `月 ${westernMoon?.sign ?? '算出なし'}${westernMoon ? westernMoon.degree.toFixed(1) : ''}°`
    if (source === 'インド占星術') return `月 ${vedicMoon?.sign ?? '算出なし'}${vedicMoon ? vedicMoon.degree.toFixed(1) : ''}°／土星 ${vedicSaturn?.sign ?? '算出なし'}${vedicSaturn ? vedicSaturn.degree.toFixed(1) : ''}°`
    if (source === '数秘術') return `運命数 ${input.lifePathNumber}`
    if (source === '九星気学') return input.kyuseiProfile?.yearStar ?? input.honmeiName
    return `${input.sukuyo}宿`
  }
  const evidenceMarker = (items: Array<{ lineage: Lineage; system: string; factor: string }>) =>
    `[[EVIDENCE:${items.map(item => `${lineageName[item.lineage]}｜${item.system}｜${item.factor}`).join('||')}]]`
  const evidenceFor = (item: typeof selectedConsensus[number]) => evidenceMarker(item.sources.map(source => ({
    lineage: sourceLineage[source], system: source, factor: sourceFactor(source),
  })))
  const domainProjection: Record<ConsensusKey, { work: string; love: string; friend: string }> = {
    initiative: { work: '停滞した場面では、最初の試作品を出して流れを作ります。', love: '好意や希望を遠回しにせず示せる関係を好みます。', friend: '新しい体験を一緒に始められる相手から刺激を受けます。' },
    communication: { work: '論点を整理し、話し合いを前へ進める役に回りやすい人です。', love: '察し合うより、言葉で確認できる関係のほうが安心できます。', friend: '考えを言葉にできる相手と、友情が長く続きます。' },
    insight: { work: '表面化していない原因を見つけ、改善の糸口を示します。', love: '相手を深く理解しようとするぶん、推測だけで結論を出しやすい面があります。', friend: '広く浅く付き合うより、本音を扱える少人数を選びます。' },
    stability: { work: '毎日の運用と改善を続け、後から大きな差を作ります。', love: '日々の約束と生活の安定を重ねるほど、愛情を実感します。', friend: '頻繁に会わなくても、約束を守る相手を長く大切にします。' },
    independence: { work: '進め方に裁量があると、専門性と集中力を発揮できます。', love: '親密さと一人で考える時間の両方を必要とします。', friend: '互いの生活へ踏み込みすぎない距離感を好みます。' },
    harmony: { work: '意見が割れたとき、両者が受け入れられる線を探します。', love: '二人の希望を同じ重さで扱えると、関係が安定します。', friend: '場の空気を整えますが、自分の希望を後回しにしがちです。' },
    responsibility: { work: '任された範囲を最後まで持ち、締め切りと品質で信頼を得ます。', love: '口にした約束を行動で守るぶん、相手にも同じ一貫性を求めます。', friend: '頼られると引き受けますが、相手の課題まで抱えがちです。' },
    transformation: { work: '古くなった手順を見直し、次に使える形へ組み替えます。', love: '変化を避けず、話し合いながら関係を更新します。', friend: '転機を支え合える一方、役目を終えた縁は手放します。' },
    creativity: { work: '経験や感覚を独自の企画・表現へ変えると評価されます。', love: '互いの感性を否定せず、刺激し合える相手に惹かれます。', friend: '作品や価値観を共有できる交流が活力になります。' },
    care: { work: '周囲が安心して動ける環境を整え、力を引き出します。', love: '与えるだけでなく、自分も頼れる関係を必要とします。', friend: '相談を受ける側になりやすく、居場所を作ります。' },
    exploration: { work: '新しい知識を取り込み、一つの専門性へ育てます。', love: '互いの挑戦と成長を応援できる関係を選びます。', friend: '異なる業界や地域の相手から視野を広げます。' },
    practicality: { work: '考えを手順・数字・成果物へ落とし込みます。', love: '気持ちだけでなく、日々の行動で信頼を確かめます。', friend: '口約束より、必要なときに動ける関係を信頼します。' },
  }
  const traitBlocks = selectedConsensus.map((item, index) => {
    const detail = consensusLabels[item.key]
    return `[[HIGHLIGHT:${index + 1}. ${detail.title}]]\n${detail.summary}\n${dailyTendencies[item.key]}\n気をつけたいのは、${shadowTendencies[item.key]}です。\nうまく活かすには、${detail.action}。\n${evidenceFor(item)}`
  }).join('\n\n')
  const workBlocks = rotate(selectedConsensus, 'work-order').map(item => domainProjection[item.key].work).join(' ')
  const loveBlocks = rotate(selectedConsensus, 'love-order').map(item => domainProjection[item.key].love).join(' ')
  const friendBlocks = rotate(selectedConsensus, 'friend-order').map(item => domainProjection[item.key].friend).join(' ')
  const combinedEvidence = evidenceMarker(selectedConsensus.flatMap(item => item.sources.map(source => ({ lineage: sourceLineage[source], system: source, factor: sourceFactor(source) }))).filter((item, index, all) => all.findIndex(other => other.system === item.system && other.factor === item.factor) === index))
  const personalYearSignals: Record<number, ConsensusKey[]> = { 1: ['initiative', 'independence'], 2: ['harmony', 'care'], 3: ['creativity', 'communication'], 4: ['stability', 'practicality'], 5: ['transformation', 'exploration'], 6: ['care', 'responsibility', 'harmony'], 7: ['insight', 'independence'], 8: ['responsibility', 'practicality'], 9: ['transformation', 'care'] }
  const kyuseiYearSignals: Record<number, ConsensusKey[]> = {
    1: ['insight', 'care'], 2: ['stability', 'care'], 3: ['initiative', 'communication'],
    4: ['harmony', 'communication'], 5: ['responsibility', 'transformation'], 6: ['responsibility', 'practicality'],
    7: ['communication', 'harmony'], 8: ['stability', 'transformation'], 9: ['creativity', 'insight'],
  }
  const annualKyuseiNumber = (year: number) => {
    let sum = String(year).split('').reduce((total, digit) => total + Number(digit), 0)
    while (sum > 9) sum = String(sum).split('').reduce((total, digit) => total + Number(digit), 0)
    return ((11 - sum - 1) % 9 + 9) % 9 + 1
  }
  const annualSignals = (themes: string[]) => {
    const text = themes.join('、')
    const keys: ConsensusKey[] = []
    if (/発信|創作|挑戦/.test(text)) keys.push('communication', 'creativity', 'initiative')
    if (/成果|収入|現実/.test(text)) keys.push('practicality', 'responsibility')
    if (/責任|肩書|正式/.test(text)) keys.push('responsibility', 'stability')
    if (/学び|資格|支援/.test(text)) keys.push('exploration', 'insight')
    if (/自立|仲間|活動範囲|組み替え/.test(text)) keys.push('independence', 'transformation')
    if (/隠れていたずれ|前提の見直し/.test(text)) keys.push('transformation', 'insight')
    if (/縁|まとまり|関係の正式化/.test(text)) keys.push('harmony', 'stability')
    return [...new Set(keys)]
  }
  const basePersonalYear = input.numerologyProfile?.personalYearNumber
  const basePersonalYearCalendar = input.numerologyProfile?.personalYear ?? currentYear
  const timingEntries = (input.timing?.annual ?? [])
    .filter(item => item.year >= currentYear - 15 && item.year <= currentYear + 20)
    .map(item => {
      const personalYear = basePersonalYear ? ((basePersonalYear - 1 + item.year - basePersonalYearCalendar) % 9 + 9) % 9 + 1 : null
      const decade = input.timing?.decades.find(period => item.year >= period.startYear && item.year <= period.endYear)
      const personalSignals = personalYear ? personalYearSignals[personalYear] ?? [] : []
      const annualShared = annualSignals(item.themes).filter(key => personalSignals.includes(key))
      const decadeShared = annualSignals(decade?.themes ?? []).filter(key => personalSignals.includes(key))
      const hasRelationshipBreak = item.relationshipSignals.some(signal => /破|冲/.test(signal))
      const relationshipOverlap: ConsensusKey[] = item.relationshipSignals.length && [2, 6].includes(personalYear ?? 0)
        ? [hasRelationshipBreak ? 'transformation' : 'harmony']
        : []
      const ziweiYear = input.ziwei?.annual?.find(entry => entry.year === item.year)
      const astrologyYear = input.astrology?.annual?.find(entry => entry.year === item.year)
      const sanmeiYearSignals: ConsensusKey[] = item.sanmeiSignals?.some(signal => signal.includes('天中殺')) ? ['transformation', 'insight'] : []
      const stemsSignals = [...new Set([...annualSignals(item.themes), ...annualSignals(decade?.themes ?? []), ...relationshipOverlap, ...sanmeiYearSignals, ...((ziweiYear?.signals ?? []) as ConsensusKey[])])]
      const ephemerisSignals = [...new Set((astrologyYear?.signals ?? []) as ConsensusKey[])]
      const kyuseiNumber = annualKyuseiNumber(item.year)
      const numberSignals = [...new Set([...personalSignals, ...(kyuseiYearSignals[kyuseiNumber] ?? [])])]
      const signalCounts = new Map<ConsensusKey, number>()
      for (const lineageSignals of [stemsSignals, ephemerisSignals, numberSignals]) {
        for (const signal of lineageSignals) signalCounts.set(signal, (signalCounts.get(signal) ?? 0) + 1)
      }
      const shared = [...signalCounts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).map(([key]) => key)
      if (!personalYear || !shared.length) return null
      const sharedLabels = shared.map(key => consensusLabels[key].title).join('・')
      const yearHeadline = item.themes.slice(0, 2).join('・') || sharedLabels
      const domain = YEAR_DOMAIN_DETAIL[item.tenGod] ?? {
        work: '役割や優先順位を見直し、今後に残す仕事を選ぶ年です。',
        love: '相手との距離や、これから望む関係を言葉にすると動きが生まれます。',
        relation: '付き合う人や所属する場所を見直す機会が増えます。',
        caution: 'その場の勢いだけで決めず、現実的な条件を確認してください。',
      }
      const yearAction = consensusLabels[shared[0]]?.action ?? 'その年に優先することを一つ決める'
      const workKeys: ConsensusKey[] = ['initiative', 'communication', 'insight', 'stability', 'independence', 'responsibility', 'transformation', 'creativity', 'exploration', 'practicality']
      const loveKeys: ConsensusKey[] = ['harmony', 'stability', 'care', 'responsibility']
      const relationKeys: ConsensusKey[] = ['communication', 'harmony', 'care', 'exploration']
      const workScore = shared.filter(key => workKeys.includes(key)).length + (/偏財|正財|偏官|正官|偏印|正印/.test(item.tenGod) ? 1 : 0)
      const loveScore = shared.filter(key => loveKeys.includes(key)).length + (item.relationshipSignals.length ? 2 : 0) + ([2, 6].includes(personalYear) ? 1 : 0)
      const relationScore = shared.filter(key => relationKeys.includes(key)).length + (/劫財|食神|傷官|偏財/.test(item.tenGod) ? 1 : 0)
      const strongestDomainScore = Math.max(workScore, loveScore, relationScore)
      const showWork = workScore >= 2 || (workScore === strongestDomainScore && strongestDomainScore < 2)
      const showLove = loveScore >= 2
      const showRelation = relationScore >= 2 && relationScore >= Math.max(workScore, loveScore)
      const isMarriage = !hasRelationshipBreak && item.relationshipSignals.length > 0 && shared.some(key => ['harmony', 'stability', 'responsibility'].includes(key))
      const domainLabels = [
        showWork ? '仕事' : '',
        isMarriage ? '結婚' : showLove ? '恋愛' : '',
        showRelation ? '人間関係' : '',
        hasRelationshipBreak ? '恋愛・人間関係の見直し' : '',
      ].filter((label, index, all) => label && all.indexOf(label) === index)
      const concrete = (text: string) => text.replace(/^.+?年は、/, '').replace(/年です。$/, '流れです。')
      const domainLines = [
        showWork ? concrete(domain.work) : '',
        showLove ? concrete(domain.love) : '',
        showRelation ? concrete(domain.relation) : '',
      ].filter(Boolean).join(' ')
      const relationship = hasRelationshipBreak
        ? ' 関係の前提や隠れていたずれが表面化し、続け方を見直す動きも起こりやすくなります。'
        : item.relationshipSignals.length && shared.some(key => ['harmony', 'stability', 'responsibility'].includes(key))
          ? ' 交際や結婚など、関係をはっきりさせる動きも起こりやすくなります。'
          : ''
      const longTermNote = decadeShared.length && decade
        ? ` 長期の流れでも${decade.themes.join('、')}が続き、単年より影響が残りやすい時期です。`
        : ''
      const majorTurningPoint = hasRelationshipBreak || isMarriage || (decadeShared.length > 0 && shared.length >= 2)
      const yearLabel = majorTurningPoint
        ? `[[TURNING:${item.year}年（${item.ageRange}）— 大きな転換期]]`
        : `[[YEAR:${item.year}年（${item.ageRange}）]]`
      const domainLabelLine = domainLabels.map(label => `[[DOMAIN:${label}]]`).join(' ')
      const astrologyNote = astrologyYear && (astrologyYear.western.length || astrologyYear.vedic.length)
        ? ` 天体の長期的な動きでも${astrologyYear.signals.includes('responsibility') ? '責任や現実化' : astrologyYear.signals.includes('harmony') ? '縁や協力' : '成長と変化'}が強まります。`
        : ''
      const ziweiNote = ziweiYear?.activePalaces.length
        ? ` 長期の人生周期では${ziweiYear.activePalaces.map(name => name === '官禄' ? '仕事' : name === '夫妻' ? '結婚・パートナーシップ' : name === '財帛' ? '収入' : '自分自身').join('・')}が動きやすい位置です。`
        : ''
      const text = `${yearLabel}\n[[SUMMARY:${yearHeadline}]] ${domainLabelLine}\n\n${domainLines}${longTermNote}${relationship}${astrologyNote}${ziweiNote}\n▸ ${domain.caution} ${yearAction}。\n${evidenceMarker([
        { lineage: 'stems', system: '四柱推命', factor: `${item.kanshi}・${item.tenGod}` },
        ...(item.sanmeiSignals?.length ? [{ lineage: 'stems' as const, system: '算命学', factor: item.sanmeiSignals.join('・') }] : []),
        ...(decadeShared.length && decade ? [{ lineage: 'stems' as const, system: '四柱推命', factor: `10年運 ${decade.kanshi}・${decade.tenGod}` }] : []),
        ...(ziweiYear ? [{ lineage: 'stems' as const, system: '紫微斗数', factor: `流年 ${ziweiYear.heavenlyStem}${ziweiYear.earthlyBranch} ${ziweiYear.activePalaces.join('・')}` }] : []),
        ...(astrologyYear ? [{ lineage: 'ephemeris' as const, system: '西洋・インド占星術', factor: [...astrologyYear.western, ...astrologyYear.vedic, `${astrologyYear.dashaLord}期`].join('・') }] : []),
        { lineage: 'number', system: '数秘術', factor: `個人年 ${personalYear}` },
        { lineage: 'number', system: '九星気学', factor: `年盤 ${kyuseiYearSignals[kyuseiNumber] ? kyuseiNumber : ''}` },
      ])}`
      return { year: item.year, text }
    })
    .filter((item): item is { year: number; text: string } => Boolean(item))
  const pastEntries = timingEntries.filter(item => item.year < currentYear)
  const futureEntries = timingEntries.filter(item => item.year >= currentYear)
  const pastTimingBlocks = pastEntries.map(item => item.text).join('\n\n')
  const futureTimingBlocks = futureEntries.map(item => item.text).join('\n\n')
  const timingBlocks = `〈過去15年の振り返り〉\n${pastTimingBlocks || '過去15年には、複数の計算で同じテーマが強く重なる年はありませんでした。'}\n\n〈これから20年の流れ〉\n${futureTimingBlocks || 'これから20年には、複数の計算で同じテーマが強く重なる年はありません。日々の状況を優先して判断してください。'}`

  // 「共通テーマ」は同じでも、実際の現れ方は命式・星図・天体の組み合わせで変わる。
  // 以下は入力ごとの実データを交差させ、テンプレートだけでは出ない個人差を文章化する層。
  const centerStarDetail = SANMEI_DETAIL[input.sanmeiStar] ?? sanmei
  const centerStarLabel = SANMEI[input.sanmeiStar] ?? input.sanmeiStar
  // 10（生来の判断軸）× 10（内面の表現傾向）× 10（五行5種×運用2種）を
  // 文章の個別化に使う。内部分類番号は利用者向け鑑定文には表示しない。
  const activeElementUse = (input.strength?.supportRatio ?? 50) >= 50
  const elementModeLabel = activeElementUse
    ? `${ELEMENT_DETAIL[strongestElement] ?? '得意な力'}を積極的に使う`
    : `${ELEMENT_DETAIL[strongestElement] ?? '得意な力'}を自分の土台にする`
  const profileTitle = `${day.core}で、${centerStarLabel}を自分らしく活かす人`
  const westStarDetail = LOVE_STYLE[westStar] ?? SANMEI_DETAIL[westStar] ?? sanmei
  const eastStarDetail = WORK_STYLE[eastStar] ?? SANMEI_DETAIL[eastStar] ?? sanmei
  const northStarDetail = SANMEI_DETAIL[northStar] ?? sanmei
  const southStarDetail = SANMEI_DETAIL[southStar] ?? sanmei
  const westernMoonDetail = astroPhrase(westernMoon?.sign, 'moon')
  const westernVenusDetail = astroPhrase(westernVenus?.sign, 'venus')
  const westernMarsDetail = astroPhrase(westernMars?.sign, 'mars')
  // 「好きになりやすい人」は配偶者位置を土台に、インド式の金星と木星を交差させる。
  // 出生時刻がない場合も共通文にせず、配偶者位置・宿曜・日柱で個別化する。
  const sanmeiAttraction = LOVE_STYLE[westStar] ?? day.love
  const vedicVenusAttraction = SIGN_BEHAVIOR[vedicVenus?.sign ?? '']?.venus
  const vedicJupiterTrust = PARTNER_GROWTH[vedicJupiter?.sign ?? '']
  const attractionDetail = vedicVenusAttraction && vedicJupiterTrust
    ? `${sanmeiAttraction}を大切にする人です。最初は${vedicVenusAttraction}。長く付き合うなら、${vedicJupiterTrust}を選びます`
    : `${sanmeiAttraction}を大切にする人です。自然に話せて、${day.love}を一緒につくれる相手に惹かれます`
  const pursuitDetail = SIGN_BEHAVIOR[westernMars?.sign ?? '']?.mars
    ?? `${SANMEI[eastStar] ?? day.strength}が行動の軸です。好意が生まれた後は、${day.love}かどうかを確かめながら進みます`
  const vedicMoonDetail = astroPhrase(vedicMoon?.sign, 'moon')
  const nakshatraDetail = NAKSHATRA_DETAIL[vedic?.moonNakshatra ?? ''] ?? '心の反応を経験へ変える力'
  const lifeNumberDetail = NUMEROLOGY_DETAIL[input.lifePathNumber] ?? mission
  const birthNumber = input.numerologyProfile?.birthDayNumber
  const attitudeNumber = input.numerologyProfile?.attitudeNumber
  const currentPhaseDetail = SUBORDINATE_DETAIL[currentPhase?.star ?? ''] ?? '現在の人生段階に必要な力を経験から育てる時期'
  const strongestDetail = ELEMENT_DETAIL[strongestElement] ?? '自然に使いやすい機能'
  const weakestDetail = ELEMENT_DETAIL[weakestElement] ?? '意識して補いたい機能'
  const primaryKey = selectedConsensus[0]?.key
  const secondaryKey = selectedConsensus[1]?.key
  const personalizedCore = pick([
    `あなたは[[HIGHLIGHT:「${profileTitle}」]]です。全体の状況を見ながら、自分が納得できるやり方も大切にします。${elementModeLabel}ことで、知識を人に分かりやすく伝えられます。`,
    `[[HIGHLIGHT:「${profileTitle}」]]という特徴があります。全体を見渡すことと、自分が大切にしたいことを両立できる人です。${elementModeLabel}ほど、迷いが減ります。`,
    `広い視野で考える一方、自分が納得できないことには簡単に流されません。この二つを持つあなたは[[HIGHLIGHT:「${profileTitle}」]]です。${lifeNumberDetail}を毎日の行動に取り入れると、良さが伝わりやすくなります。`,
  ], 'personalized-core')
  const personalizedContrast = primaryKey && secondaryKey
    ? `あなたの個性は、**${consensusLabels[primaryKey].title}**と${consensusLabels[secondaryKey].title}を同時に使う点にあります。「${consensusLabels[primaryKey].action}」の後に「${consensusLabels[secondaryKey].action}」という順番にすると、内面の迷いを行動へ変えやすくなります。`
    : ''
  const personalizedEmotion = westernMoon?.sign && vedicMoon?.sign && westernMoon.sign === vedicMoon.sign
    ? `気持ちを落ち着かせるには、人と話して考えを整理する時間が必要です。疲れているときはすぐに結論を出さず、「いま感じていること」「実際に起きたこと」「これからどうしたいか」の順に分けると冷静さを取り戻せます。`
    : westernMoon?.sign && vedicMoon?.sign ? `気持ちが乱れたときは、次の三つを分けて考えると落ち着きます。
- 人に見せやすい反応：${SIGN_BEHAVIOR[westernMoon?.sign ?? '']?.moon ?? westernMoonDetail}
- 本当は必要としていること：${SIGN_BEHAVIOR[vedicMoon?.sign ?? '']?.moon ?? vedicMoonDetail}
- とっさに出やすい反応：${nakshatraDetail}` : ''
  const strongestIsFavorable = input.strength?.favorableElements.includes(strongestElement)
  const favorableBridge = strongestIsFavorable
    ? `これはもともと得意なうえ、意識して使うほど自分を支えてくれる長所です。強く出ていることと、味方になることは矛盾しません。`
    : `一方で、別の力を意識して取り入れると、得意なことへ偏りすぎずに済みます。`
  const personalizedElements = pick([
    `自然に使いやすいのは「${strongestDetail}」です。${favorableBridge} 「${weakestDetail}」は、習慣・道具・得意な人の助けで補うと全体が整います。`,
    `「${strongestDetail}」は考えるときにも動くときにも頼れる土台です。${favorableBridge} 一方の「${weakestDetail}」は、外部の仕組みに任せる方が無理なく補えます。`,
    `得意な「${strongestDetail}」へ集中すると判断が速くなります。${favorableBridge} 不足しやすい「${weakestDetail}」まで一人で担わず、手順や協力者を使ってください。`,
  ], 'personalized-elements')
  const personalizedLove = westernVenus && westernMars
    ? `親密になるほど、${westStarDetail}という関わり方が前面に出ます。
惹かれるときは、${SIGN_BEHAVIOR[westernVenus.sign]?.venus ?? westernVenusDetail}。一方、気持ちが動いた後は、${SIGN_BEHAVIOR[westernMars.sign]?.mars ?? westernMarsDetail}。そのため、好きになる速さと信頼を決める速さは必ずしも同じではありません。`
    : `親密になるほど「${westStarDetail}」という関わり方が前面に出ます。一方、関係を進める場面では「${eastStarDetail}」が働きます。**求める安心と、実際に取る行動の違い**を自覚すると、無理のない速度で信頼を育てられます。`
  const inwardMarsPattern = westernMars?.retrograde || vedicMars?.retrograde
    ? `**好意・怒り・違和感を、その場ですぐ外へ出すより、一度自分の内側で確かめる人です。** 普段は抑えていても、限界を越えた後に強い言葉や決断として表れやすいため、小さな違和感の段階で伝える方が関係を守れます。強い相手に惹かれることと、強引に押されることが苦手なのは矛盾しません。`
    : ''
  const aspectText = western?.aspects.join('、') ?? ''
  const innerProcessingPatterns = [
    westernMercury?.retrograde
      ? '考えや言葉をすぐ確定せず、内側で何度か組み直してから伝える傾向があります。返答を急かされない環境の方が、本来の精度を出せます。'
      : '',
    westernJupiter?.retrograde
      ? '成長や成功の基準を世間から借りるより、自分で意味を確かめたときに力が伸びます。'
      : '',
    westernSaturn?.retrograde
      ? '責任を外から言われる以上に重く受け止めやすく、自分だけに厳しい基準を課しがちです。'
      : '',
  ].filter(Boolean).join(' ')
  const deepChangePattern = /太陽と冥王星の(?:スクエア|オポジション|コンジャンクション)/.test(aspectText)
    ? '人生の大きな節目では、仕事や人間関係を少し直すだけでなく、環境そのものを変える決断をしやすい人です。人に決められると強いストレスを感じるため、最後は自分で選べる状態を作ってください。'
    : ''
  const emotionalVoltagePattern = /月と(?:天王星|海王星)の(?:スクエア|オポジション)/.test(aspectText)
    ? '周りの雰囲気や急な予定変更に疲れやすいところがあります。平気そうに見えても気持ちが大きく揺れることがあるため、予定を詰めすぎず、一人で落ち着く時間を取ってください。'
    : ''
  const expansionBrakePattern = /木星と土星の(?:スクエア|オポジション)/.test(aspectText)
    ? '仕事では「もっと広げたい気持ち」と「失敗しない形へ固めたい気持ち」が同時に働きます。大きく賭けるより、試す範囲を決めて段階的に広げる方法が合います。'
    : ''
  const wholeChartCorePattern = [innerProcessingPatterns, deepChangePattern].filter(Boolean).join(' ')
  const wholeChartWorkPattern = expansionBrakePattern
  const wholeChartRecoveryPattern = emotionalVoltagePattern
  const houseArea: Record<number, string> = {
    1: '自分らしさと第一印象', 2: '収入・所有・自己価値', 3: '学習・会話・身近な移動', 4: '家庭・居場所・心の土台',
    5: '恋愛・創作・自己表現', 6: '働き方・習慣・健康管理', 7: '結婚・契約・対等な関係', 8: '深い共有・喪失と再生',
    9: '専門学習・思想・遠方との縁', 10: '仕事・肩書・社会的達成', 11: '仲間・将来計画・社会との接点', 12: '内省・休息・見えない負担',
  }
  const identityAndDirectionPattern = western
    ? `初対面では、${SIGN_BEHAVIOR[western.ascendant.sign]?.lagna ?? '周囲の様子を見てから動きます'}。仕事では、${ASTRO_SIGN[western.midheaven?.sign ?? ''] ?? '任された役割を成果にすること'}が評価されやすい人です。${sunHouse ? `${houseArea[sunHouse]}に関わる経験が、自信につながりやすくなります。` : ''}`
    : ''
  const emotionalAreaPattern = moonHouse
    ? `気持ちが不安定なときは、${houseArea[moonHouse]}で無理をしていないか確認してください。ここを整えると落ち着きやすくなります。`
    : ''
  const maturityAreaPattern = saturnHouse
    ? `${houseArea[saturnHouse]}は、経験を重ねるほど上手になる分野です。最初から完璧を目指さず、無理をしない範囲と続けられる習慣を決めてください。`
    : ''
  const palaceTheme = (stars: string, fallback: string) => {
    if (/紫微|天府|天梁|武曲/.test(stars)) return '責任を引き受け、長期的な信用と成果を築くこと'
    if (/天機|巨門|太陽|太陰/.test(stars)) return '考えを整理し、言葉・知識・観察を役立てること'
    if (/破軍|七殺|廉貞|貪狼/.test(stars)) return '変化を恐れず、古い仕組みを次の形へ更新すること'
    if (/天同|天相/.test(stars)) return '人との協力や調整を通じて、安心できる流れを作ること'
    return fallback
  }
  const easternDomainPattern = input.ziwei?.available
    ? `領域ごとの長期テーマは次のとおりです。
- 仕事：${palaceTheme(careerPalaceStars, '一つの専門性を磨くこと')}
- お金：${palaceTheme(wealthPalaceStars, '収支と価値の基準を自分で持つこと')}
- 親密な関係：${palaceTheme(couplePalaceStars, '対等な約束を育てること')}
- 友人関係：${palaceTheme(friendsPalaceStars, '助け合う範囲を明確にすること')}`
    : ''
  const relationshipChangePattern = input.sanmeiRelations?.relations.length
    ? pick([
        `人や環境との結びつきには、${input.sanmeiRelations.relations.map(item => item.meaning).join('。また、')}という動きがあります。変化の後は、元へ戻すより新しい関係の形を作る視点が役立ちます。`,
        `${input.sanmeiRelations.relations.map(item => item.meaning).join('。')}ことが、縁の変化に表れます。以前と同じ状態へ戻すことだけを正解にしないでください。`,
        `縁が動くときの特徴は、${input.sanmeiRelations.relations.map(item => item.meaning).join('。また、')}こと。変化を修復だけで終わらせず、次の付き合い方を決める機会にできます。`,
      ], 'relationship-change')
    : ''
  const lifeEnergyPattern = [earlyStar, middleStar, lateStar].every(Boolean)
    ? pick([`年代ごとの動き方には、次の違いがあります。
- 若い時期：${SUBORDINATE_DETAIL[earlyStar!.star].replace(/エネルギー/g, '傾向')}
- 中年期：${SUBORDINATE_DETAIL[middleStar!.star].replace(/エネルギー/g, '傾向')}
- その後：${SUBORDINATE_DETAIL[lateStar!.star].replace(/エネルギー/g, '傾向')}
時期に応じて力の使い方が変わる人です。`,
      `人生の前半・中盤・後半では、前面に出る力が移ります。
- 若い時期：${SUBORDINATE_DETAIL[earlyStar!.star].replace(/エネルギー/g, '傾向')}
- 中年期：${SUBORDINATE_DETAIL[middleStar!.star].replace(/エネルギー/g, '傾向')}
- その後：${SUBORDINATE_DETAIL[lateStar!.star].replace(/エネルギー/g, '傾向')}
過去と今の自分が違って見えても、矛盾ではありません。`,
      `長い時間で見ると、同じ方法を使い続けるタイプではありません。
- 若い時期：${SUBORDINATE_DETAIL[earlyStar!.star].replace(/エネルギー/g, '傾向')}
- 中年期：${SUBORDINATE_DETAIL[middleStar!.star].replace(/エネルギー/g, '傾向')}
- その後：${SUBORDINATE_DETAIL[lateStar!.star].replace(/エネルギー/g, '傾向')}
現在の年代に合う力を優先すると流れが整います。`,
    ], 'life-energy')
    : ''
  const monthTenGod = input.fourPillars?.find(pillar => pillar.label === '月柱')?.stemTenGod ?? ''
  const monthTenGodDetail = TEN_GOD_DETAIL[monthTenGod] ?? '経験を成果へ変えること'
  const personalizedWork = pick([
    `仕事では「${eastStarDetail}」という進め方が評価につながります。短期では${monthTenGodDetail}を扱い、長期では${NUMEROLOGY_DETAIL[input.lifePathNumber] ?? mission}へつながる環境を選ぶと、個性が成果になります。`,
    `成果を出す入口は「${eastStarDetail}」です。${monthTenGodDetail}を任される経験が、やがて${NUMEROLOGY_DETAIL[input.lifePathNumber] ?? mission}という長期テーマへつながります。`,
    `職種名より、「${eastStarDetail}」を使える裁量があるかを確認してください。${monthTenGodDetail}を実務で磨くほど、${NUMEROLOGY_DETAIL[input.lifePathNumber] ?? mission}が形になります。`,
  ], 'personalized-work')
  const relationRoles = [
    ['対等な相手', SANMEI[eastStar] ?? '自分らしさ'],
    ['目上の相手', SANMEI[northStar] ?? '慎重さ'],
    ['後輩や守る相手', SANMEI[southStar] ?? '行動力'],
  ]
  const distinctRoleValues = new Set(relationRoles.map(([, value]) => value))
  const personalizedRelations = distinctRoleValues.size === 1
    ? `相手を問わず「${relationRoles[0][1]}」という同じ姿勢が出ます。立場ごとに無理に振る舞いを変える必要はありません。`
    : pick([
        `関係の距離に応じて役割が変わります。\n${relationRoles.map(([label, value]) => `- ${label}には：${value}`).join('\n')}\nどの相手にも合わせ切らず、引き受ける範囲を示してください。`,
        `相手によって前面に出る面が異なります。\n${relationRoles.map(([label, value]) => `- ${label}には：${value}`).join('\n')}\n違いは矛盾ではなく、距離を読み分ける性質です。`,
        `人との距離ごとに、使う強みを選びます。\n${relationRoles.map(([label, value]) => `- ${label}には：${value}`).join('\n')}\n一つの役割へ固定せず、無理のない境界線を保ってください。`,
      ], 'personalized-relations')
  const lifeStageTail = `${birthNumber ? `生まれ持った得意分野は「${NUMEROLOGY_DETAIL[birthNumber] ?? '自然な強み'}」` : ''}${attitudeNumber ? `${birthNumber ? '、' : ''}人から見える入口は「${NUMEROLOGY_DETAIL[attitudeNumber] ?? '状況に合わせる力'}」` : ''}です。`
  const personalizedLifeStage = pick([
    `今は「${currentPhaseDetail}」を経験から育てる段階です。「${currentTimingThemes || '役割や優先順位を見直すこと'}」を、現在の役割に合う形へ翻訳してください。${lifeStageTail}`,
    `現在の時間軸では「${currentTimingThemes || '役割や優先順位を見直すこと'}」が前面に出ます。その土台になるのが「${currentPhaseDetail}」です。${lifeStageTail}`,
    `生まれ持った性質をそのまま繰り返すより、「${currentPhaseDetail}」を今の生活で使い直す時期です。流れの中心には「${currentTimingThemes || '役割や優先順位を見直すこと'}」があります。${lifeStageTail}`,
  ], 'life-stage')
  const uniqueWorkPattern = `得意領域は${day.work}です。共通するのは職種名ではなく、[[HIGHLIGHT:「${day.strength}」を使えること]]。反対に、${day.caution}が続く環境では消耗しやすいため、仕事を選ぶときは業界よりも意思決定の速さ、裁量、評価基準を確認してください。`
  const uniqueLovePattern = `もともと求めるのは[[HIGHLIGHT:${day.love}]]です。親密な関係では、${westStarDetail}。惹かれる条件と衝突時の動き方には差があるため、強く惹かれた直後より、意見が違ったときに互いがどう話すかを見る方が相性を判断できます。`
  const uniqueRecoveryPattern = pick([
    `負荷が高いときは、本質で触れた落とし穴がここでも出やすくなります。「${weakestDetail}」を予定や道具、協力者で補うと判断力が戻ります。`,
    `余裕を失ったときは、同じ癖を繰り返していないか確認してください。不足しやすい「${weakestDetail}」を外の仕組みに任せると立て直せます。`,
    `疲れたときほど、得意な方法だけで押し切らないこと。「${weakestDetail}」を補う手順を先に用意すると、本来の判断へ戻れます。`,
  ], 'unique-recovery')
  const workScene = pick([
    `会議では${SANMEI[eastStar] ?? '自分の判断軸'}が先に出て、仕上げでは${monthTenGodDetail}が強く働きます。`,
    `仕事を始める入口は${SANMEI[eastStar] ?? '自分らしい進め方'}、成果として残したいものは${NUMEROLOGY_DETAIL[input.lifePathNumber] ?? mission}です。`,
    `周囲からは役割の中心を担う人と見られやすく、実務では${monthTenGodDetail}を引き受けると評価が定着します。`,
  ], 'work-scene')
  const loveScene = pick([
    `惹かれる入口は${LOVE_STYLE[westStar] ?? day.love}ですが、関係を進めるときは${SANMEI[eastStar] ?? '自分のペース'}が前に出ます。`,
    `安心の条件は${day.love}で、好意を行動へ移す場面では${SANMEI[eastStar] ?? '率直な行動'}を選びやすい人です。`,
    `二人きりでは${SANMEI[westStar] ?? '親密さ'}を求め、意見が割れた場面では「${day.caution}」が課題として現れます。`,
  ], 'love-scene')
  const relationScene = pick([
    `初対面では${NUMEROLOGY_DETAIL[input.numerologyProfile?.attitudeNumber ?? 0] ?? '相手を観察する姿勢'}が出やすく、親しくなると${SANMEI[eastStar] ?? '本来の行動力'}が見えてきます。`,
    `集団では${SANMEI[eastStar] ?? '場に応じた役割'}を担い、少人数では${SANMEI[westStar] ?? '身近な人への関わり方'}を大切にします。`,
    `人との距離は、本音を安全に扱えるかどうかで決めます。役割を持つと${SANMEI[northStar] ?? '責任感'}が強まります。`,
  ], 'relation-scene')
  const vedicDetailBlock = vedic
    ? `ラヒリ・アヤナーンシャ**${vedic.ayanamsha.toFixed(3)}°**を使ったサイデリアル方式です。出生地と出生時刻から算出したラグナは**${vedic.ascendant.sign}${vedic.ascendant.degree.toFixed(1)}°**です。

**ラグナ（生き方・外への現れ方）：** ${vedic.ascendant.sign}${vedic.ascendant.degree.toFixed(1)}°（インド／サイデリアル）。${astroPhrase(vedic.ascendant.sign, 'lagna')}。
**太陽（目的意識）：** ${vedicSun?.sign ?? '算出なし'}${vedicSun ? `${vedicSun.degree.toFixed(1)}°` : ''}（インド／サイデリアル）。${astroPhrase(vedicSun?.sign, 'sun')}。
**月（心・習慣）：** ${vedicMoon?.sign ?? '算出なし'}${vedicMoon ? `${vedicMoon.degree.toFixed(1)}°` : ''}。「${vedicMoonDetail}」が安心の条件と感情の整え方に表れます。
**ナクシャトラ：** **${vedic.moonNakshatra} 第${vedic.moonPada}パーダ**。「${nakshatraDetail}」が、無意識の反応、縁の感じ方、習慣に現れます。
**水星（思考・伝達）：** ${vedicMercury?.sign ?? '算出なし'}${vedicMercury ? `${vedicMercury.degree.toFixed(1)}°` : ''}（インド／サイデリアル）。${astroPhrase(vedicMercury?.sign, 'mercury')}。
**金星（愛情・価値観）：** ${vedicVenus?.sign ?? '算出なし'}${vedicVenus ? `${vedicVenus.degree.toFixed(1)}°` : ''}（インド／サイデリアル）。${astroPhrase(vedicVenus?.sign, 'venus')}。
**火星（行動・衝突時の反応）：** ${vedicMars?.sign ?? '算出なし'}${vedicMars ? `${vedicMars.degree.toFixed(1)}°` : ''}${vedicMars?.retrograde ? '・逆行' : ''}（インド／サイデリアル）。${astroPhrase(vedicMars?.sign, 'mars')}。逆行は弱さではなく、衝動を内側で検討してから表しやすい配置として読みます。
**木星（発展・学び）：** ${vedicJupiter?.sign ?? '算出なし'}${vedicJupiter ? `${vedicJupiter.degree.toFixed(1)}°` : ''}（インド／サイデリアル）。${astroPhrase(vedicJupiter?.sign, 'jupiter')}。
**土星（責任・成熟）：** ${vedicSaturn?.sign ?? '算出なし'}${vedicSaturn ? `${vedicSaturn.degree.toFixed(1)}°` : ''}（インド／サイデリアル）。${astroPhrase(vedicSaturn?.sign, 'saturn')}。

**インド占星術から見る仕事：** ラグナの行動様式、木星の発展方向、土星の成熟課題を合わせ、短期的な職業名よりも、長期的に学びと責任を積み上げられる環境を重視します。
**インド占星術から見る恋愛：** 金星が求める価値と火星の行動反応に加え、月とナクシャトラが示す安心条件を確認します。強く惹かれるかだけでなく、日常で感情を安全に扱える関係かが重要です。

主要天体：${planetLine(vedic.planets, 'インド／サイデリアル')}

この欄はラーシ（サイン）、ラグナ、月のナクシャトラを表示しています。ダシャーや分割図は、出生地点を市区町村単位で確認してから扱う必要があるため、現在は断定表示していません。`
    : input.astrology?.reason ?? '出生時刻が不明なため、ラグナを含むインド占星術の詳細は算出していません。'

  // Coverage means that a family was calculated, not that it happened to vote
  // for one of the three strongest consensus themes. Using selectedConsensus
  // here incorrectly reported 3/4 when all four families had valid results.
  const availableLineages = new Set<Lineage>(['stems', 'number'])
  if (westernSun || westernMoon || vedic) availableLineages.add('ephemeris')
  if (input.sukuyo || sukuyoDetail) availableLineages.add('lunar')
  const hasKnownBirthTime = Boolean(input.birthTime) || (input.birthTime === undefined && input.astrology?.available)
  const coverageNote = hasKnownBirthTime
    ? `参照できた系統：${availableLineages.size}/4`
    : `参照できた系統：${availableLineages.size}/4（出生時刻不明のため天体系の一部を除外）`
  const uniqueParagraphs = [
    { score: selectedConsensus[0]?.score ?? 0, text: personalizedCore },
    { score: input.astrology?.available ? 2.5 : 0, text: [identityAndDirectionPattern, personalizedEmotion, emotionalAreaPattern, wholeChartCorePattern].filter(Boolean).join('\n') },
    { score: Math.max(...Object.values(input.elementBalance?.scores ?? { none: 0 })), text: [personalizedElements, uniqueRecoveryPattern, wholeChartRecoveryPattern].filter(Boolean).join('\n') },
    { score: input.timing?.decades.length ?? 0, text: [maturityAreaPattern, lifeEnergyPattern, relationshipChangePattern, easternDomainPattern].filter(Boolean).join('\n') },
  ].filter(item => item.text).sort((a, b) => b.score - a.score).map(item => item.text).join('\n')
  const combinationIntro = primaryKey && secondaryKey ? pick([
    `${consensusLabels[primaryKey].title}と${consensusLabels[secondaryKey].title}を同時に使う点が、この人らしさです。まず「${consensusLabels[primaryKey].action}」、次に「${consensusLabels[secondaryKey].action}」の順で進めると、考えを現実の選択へ移しやすくなります。`,
    `あなたらしさは、${consensusLabels[primaryKey].title}だけでなく${consensusLabels[secondaryKey].title}も一緒に働くところにあります。「${consensusLabels[primaryKey].action}」で土台を作り、その後に「${consensusLabels[secondaryKey].action}」へ進むと迷いが減ります。`,
    `中心にある${consensusLabels[primaryKey].title}を、${consensusLabels[secondaryKey].title}が別の角度から支えます。最初の一手は「${consensusLabels[primaryKey].action}」、仕上げは「${consensusLabels[secondaryKey].action}」が合います。`,
  ], 'combination-intro') : '共通して現れた本質を、状況に応じて使う人です。'

  const report = `【先に読む要約】
${coverageNote}
${strongest ? `結論として、あなたに最も強く表れているのは[[HIGHLIGHT:「${consensusLabels[strongest.key].title}」]]です。` : 'いくつかの計算で共通した傾向を中心にまとめています。'}
- 人生の軸：${strongest ? destinyTendencies[strongest.key] : '自分の資質を、周囲が使える具体的な形へ変えること'}。
- 気をつけたいこと：${strongest ? shadowTendencies[strongest.key] : day.caution}。
- 今日から試すこと：${strongest ? consensusLabels[strongest.key].action : '判断理由を一文にする'}。

【共通して現れた本質】
${traitBlocks}

【あなた固有の組み合わせ】
${combinationIntro}
${uniqueParagraphs}
${combinedEvidence}

【仕事】
${workBlocks}

${workScene}
${personalizedWork}
${wholeChartWorkPattern}
${uniqueWorkPattern}
収入面では、得意なことを成果物として見える形にし、依頼の範囲・期限・対価を先に決めると安定します。
${combinedEvidence}

【恋愛・結婚】
- 惹かれやすい人：${attractionDetail}。第一印象だけでなく、一緒に過ごしても同じ良さを感じられるかを見ると、本当に合う相手を見分けやすくなります。
- 恋の始まり方：${pursuitDetail}。気持ちが動いた後も、自分のペースと相手の反応が合っているかを確かめながら関係を育てます。
- 関係が安定する条件：${loveBlocks}
- すれ違いやすい場面：本質で触れた注意点が、親しい相手にも出やすくなります。小さな違和感のうちに、相手の気持ちを決めつけず、質問して確かめてください。
- 長く続けるために話しておくこと：${day.love}を実現するために、連絡頻度・一人で過ごす時間・将来の優先順位を具体的に確認すると安心です。
${combinedEvidence}

【人間関係】
${friendBlocks}

${relationScene}
${personalizedRelations}
疲れたときは本質で触れた落とし穴を繰り返していないか確認し、無理な役割だけを手放してください。
${combinedEvidence}

【時期 — 重なりの強い年】
${personalizedLifeStage}

${timingBlocks}
ここに表示する年は、出来事が必ず起こるという意味ではありません。複数の計算で同じテーマが強く出た期間だけを載せています。

【迷ったときの順序・注記】
自分の希望を言葉にする → 現実条件を数字で確認する → 小さく試す → 続けるか決める。

一つの見方だけに出た特徴は本文へ載せていません。同じ出生データなら、同じ計算結果から読み解きます。この鑑定は将来を決めつけるものではなく、自分の気持ちや選択肢を整理するための参考情報です。

詳しい計算要素は、画面上部の「命式・計算データ」で確認できます。`
  const sections = report.split(/(?=^【.+?】$)/gm).filter(Boolean)
  return renderReportBlocks(sections.map((section, index) => ({
    id: section.match(/^【(.+?)】/)?.[1] ?? `section-${index}`,
    render: () => section,
  })), identityKey)

  /* 旧・占術別詳細レポート（全占術一致版への移行履歴として一時保持）
  return `【全占術統合鑑定 — 総合結論】
四柱推命の日主${input.shichuDay[0]}は「${day.core}」、算命学の中心星${input.sanmeiStar}は「${sanmei}」、紫微斗数の命宮は「${soulPalaceStars}」、宿曜は${input.sukuyo}宿、九星は${input.kyuseiProfile?.yearStar ?? input.honmeiName}、数秘は運命数${input.lifePathNumber}です。
これらすべてを重ねると、**あなたは「${day.strength}を使いながら、${mission}を人生テーマにする人」**です。宿曜の「${sukuyoDetail}」が対人感覚を、九星気学の「${honmeiDetail}」が社会での動き方を補強します。
**最大の強みは${day.strength}。注意点は${day.caution}です。** 外から期待される役割と自分が守りたい感覚を分け、判断の理由を短く言葉にすると、持ち味が安定して発揮されます。
${western && vedic ? `西洋占星術では太陽${westernSun?.sign}・月${westernMoon?.sign}・ASC${western.ascendant.sign}、インド占星術では太陽${vedicSun?.sign}・月${vedicMoon?.sign}・ラグナ${vedic.ascendant.sign}です。**東洋の命式が示す資質に、太陽の目的意識、月の感情反応、ASC／ラグナの外への見せ方を重ねて総合判断しています。**` : ''}

【全占術統合鑑定 — 思考・感情・行動・対人】
**思考：** 算命学の北方${northStar}は「${SANMEI[northStar] ?? '自分なりの視点'}」を示し、日主${input.shichuDay[0]}の${day.core}と重なります。情報を広く集めてから本質を選び取る一方、選択肢が増えるほど結論が遅れやすいため、判断期限と基準を先に決めると力を活かせます。
**感情：** 中心星${input.sanmeiStar}の${sanmei}と宿曜${input.sukuyo}宿の「${sukuyoDetail}」から、表面は自然体でも内側では人や場の変化を細かく感じ取る傾向があります。感情をすぐ結論にせず、事実・解釈・希望の三つに分けて言葉にすると安定します。
**行動：** 南方${southStar}の「${SANMEI[southStar] ?? '行動力'}」と数秘${input.lifePathNumber}の「${mission}」が、受け身より自分で始めるほど運が動くことを示します。大きく賭けるより、小さく開始して改善する方法が向きます。
**対人：** 東方${eastStar}は社会での距離感、西方${westStar}は近しい相手への接し方です。外では${WORK_STYLE[eastStar] ?? '自分の方針を保つ'}、内では${LOVE_STYLE[westStar] ?? '信頼を積み重ねる'}という使い分けがあり、親しくなるほど約束と継続を重視します。

【全占術統合鑑定 — 才能・仕事・お金】
四柱推命では${day.work}、算命学では東方${eastStar}の「${WORK_STYLE[eastStar] ?? SANMEI[eastStar]}」、紫微斗数では官祿宮${careerPalaceStars}・財帛宮${wealthPalaceStars}が仕事と収入の使い方を示します。九星の${input.kyuseiProfile?.yearStar ?? input.honmeiName}は、社会の中心で責任を引き受ける動き方を補足します。
**仕事の総合結論は、${day.strength}を、${WORK_STYLE[eastStar] ?? '自分の専門性を活かす働き方'}へつなげること。** 得意な${strongestElement}を軸に、少ない${weakestElement}の「${ELEMENT_DETAIL[weakestElement] ?? '不足しやすい機能'}」は手順・道具・協力者で補うと成果と収入が安定します。肩書より、裁量・評価基準・価値提供の方法が自分に合うかを重視してください。
${vedic ? `インド占星術ではラグナ${vedic.ascendant.sign}の「${ASTRO_SIGN[vedic.ascendant.sign]}」、木星${vedicJupiter?.sign}の「${ASTRO_SIGN[vedicJupiter?.sign ?? ''] ?? '発展の方向'}」、土星${vedicSaturn?.sign}の「${ASTRO_SIGN[vedicSaturn?.sign ?? ''] ?? '責任の持ち方'}」を仕事の補助線にします。**短期的な適職名より、長期的に責任を持って育てられる領域を選ぶことが重要です。**` : ''}
**向く役割：** 情報整理、企画、改善、専門分野の発信、複数の人や領域をつなぐ役割。${day.work}のように、知識を現実の判断へ変える仕事で強みが出ます。
**向く環境：** 目的と評価基準は明確だが、進め方には裁量がある環境。短期成果だけを競うより、専門性と信頼を積み上げられる場が合います。
**お金の扱い：** 財帛宮${wealthPalaceStars}は、発信・行動と蓄積・配慮の両方を求めます。収入源と生活防衛資金を分け、感情で使う予算をあらかじめ決めると、稼ぐ力と守る力のバランスが整います。
**つまずきやすい点：** ${day.caution}。完成度を上げ続ける前に、締切・採算・終了条件を数値で置くことが重要です。

【全占術統合鑑定 — 恋愛・結婚・パートナーシップ】
算命学の西方${westStar}は「${LOVE_STYLE[westStar] ?? '信頼を積み重ねる関係'}」、四柱推命の日主${input.shichuDay[0]}は「${day.love}」を求めやすく、紫微斗数の夫妻宮は${couplePalaceStars}です。宿曜の${input.sukuyo}宿は、相手の本音や場の機微を読む対人感覚を加えます。
${westernVenus && westernMars ? `西洋占星術では、金星${westernVenus.sign}が「好み・受け取る愛情」、火星${westernMars.sign}が「欲求・自分から動く方法」を示します。金星の${ASTRO_SIGN[westernVenus.sign]}と火星の${ASTRO_SIGN[westernMars.sign]}を両立できる関係が自然です。` : ''}
${vedicVenus && vedicMars ? `インド占星術では金星${vedicVenus.sign}が関係に求める価値、火星${vedicMars.sign}${vedicMars.retrograde ? '逆行' : ''}が欲求と衝突時の反応を示します。**惹かれる気持ちだけでなく、安心できる生活条件と怒りや違和感を安全に話せるかを確認すること**が関係を守ります。` : ''}
**恋愛・結婚の総合結論は、安心できる日常と互いの自由を同時に守れる関係を選ぶこと。** 好意だけで進めず、生活の分担、金銭感覚、仕事への理解、一人になる時間を具体的に話すほど長続きします。婚期候補は確定日ではなく、出会い・進展・見直しが起こりやすい期間として活用してください。
**惹かれやすい相手：** 会話が成立し、考えを更新でき、約束を行動で守る人。夫妻宮${couplePalaceStars}から、知性・企画力・言葉の相性が関係の入口になりやすい傾向です。
**愛情表現：** 西方${westStar}の性質から、派手な演出より、連絡・生活・気遣いを継続することで愛情を示します。相手にも同じ表現を無意識に求めすぎないことが大切です。
**関係の課題：** 相手の本音を読みすぎて確認を省くこと、または考えがまとまるまで話さないこと。推測ではなく「私はこう感じた」「あなたはどう考える」の順で確認すると誤解が減ります。
**結婚生活：** 家事、固定費、貯蓄、一人の時間、仕事の繁忙期を具体的に合意できる相手ほど安定します。婚期の年は関係を急いで決める年ではなく、現実条件を話し合う好機です。

【全占術統合鑑定 — 家族・居場所・人間関係】
紫微斗数では父母宮${parentsPalaceStars}、田宅宮${homePalaceStars}、交友関係を示す僕役宮${friendsPalaceStars}です。算命学では北方${northStar}が親・目上、東方${eastStar}が友人・社会との接点を示します。
**家族・目上との関係：** 尊敬と自立の両方が必要です。役割を引き受けすぎず、できること・できないこと・期限を先に伝えると関係が整います。
**居場所：** 休む場所と考える場所を分け、物や情報の定位置を決めるほど回復しやすくなります。住環境は見栄より、静けさ・動線・自分で整えられる範囲を優先してください。
**友人・仲間：** 変化や挑戦を恐れない人との縁が刺激になります。ただし、広く関わり続けるより、目的と信頼が一致する少人数と長く協力する方が力を発揮できます。

【全占術統合鑑定 — 心身の整え方】
紫微斗数の疾厄宮は${healthPalaceStars}、五行では${strongestElement}が強く${weakestElement}が少ない配置です。これは病気の診断ではなく、生活の偏りを振り返るための補助線として読みます。
**疲れのサイン：** 情報を集め続ける、決められない、他人の反応を先回りして考える状態。思考量が増えたときほど、睡眠・食事・移動・予定数など測れる生活条件から整えてください。
**回復方法：** 一人で情報を整理する時間と、身体を動かして思考を止める時間を分けること。休息にも終了時刻を作り、翌日に持ち越す判断を明文化すると回復しやすくなります。
**注意：** 体調上の不安や症状は占術で判断せず、医療機関など専門家へ相談してください。

【全占術統合鑑定 — 過去・現在・これから】
初年期の${earlyStar?.star ?? '従星'}は「${SUBORDINATE_DETAIL[earlyStar?.star ?? ''] ?? '経験を自分の力へ変える傾向'}」、${currentPhaseLabel}の${currentPhase?.star ?? '従星'}は「${SUBORDINATE_DETAIL[currentPhase?.star ?? ''] ?? '現在の役割に必要な力'}」を示します。現在は${currentTimingSummary || '人生段階と年運を重ねて確認する時期'}です。
**今の総合テーマは、${currentAnnual?.themes.join('、') ?? currentDecade?.themes.join('、') ?? '現在の強みを再現できる形へ整えること'}。** 四柱推命の大運・年運、算命学の従星、紫微斗数の大限、数秘術の個人年は時間幅が異なるため、共通して現れるテーマを優先し、現実の行動計画へ落とし込みます。
**過去から持ち越しやすいもの：** 初年期に身につけた責任感や安定を守る力。現在は、それを「全部自分で守る」から「仕組みにして人と共有する」方向へ更新する時期です。
**現在の使い方：** 学ぶだけで終わらせず、成果物・収入・契約・役割など目に見える形へ変えること。個人年の変化性は、無計画な方向転換ではなく、小さな実験に使うと活きます。
**次の段階への準備：** 現在の大運が切り替わる前に、続ける専門性、手放す役割、守る生活条件の三つを整理してください。年運一覧では、複数のサインが重なる年を優先して確認します。

【全占術統合鑑定 — 開運アクション】
**最初に行うこと：${ELEMENT_DETAIL[weakestElement] ?? '不足しやすい機能'}を補う小さな習慣を一つ決める。**
**仕事では：** ${WORK_STYLE[eastStar] ?? '強みを繰り返し使える環境を選ぶ'}。
**恋愛・人間関係では：** 希望・不安・境界線を短い言葉で共有する。
**運気の節目では：** 天中殺や冲だけで判断せず、資金・健康・契約を確認し、小さく試してから決断する。

【鑑定根拠 — 四柱推命】

${pillarDetail}
五行バランスは${elementDetail}です（${input.elementBalance?.method ?? '簡易集計'}）。最も強い${strongestElement}は「${ELEMENT_DETAIL[strongestElement] ?? '固有の働き'}」が自然に使いやすい一方、最も少ない${weakestElement}は意識的に補う余地があります。
月令を加味した扶助比率は${input.strength?.supportRatio ?? '-'}%で、**旺衰の簡易判定は${input.strength?.label ?? '算出なし'}**です。**補う五行の目安は${input.strength?.favorableElements.join('・') ?? '算出なし'}**。これは格局や調候まで含めた喜神・忌神の断定ではなく、五行の偏りを見るための補助指標です。

【鑑定根拠 — 算命学の人体星図・十二大従星】
${bodyChartDetail}
**中心星${input.sanmeiStar}の要点は、${sanmei}です。** 中央だけで性格を固定せず、北・西・東・南で異なる場面の表れ方も合わせて読みます。

十二大従星は、人生段階ごとのエネルギーの使い方を表します。
${subordinateDetail}

【鑑定根拠 — 算命学の位相法と天中殺】
${sanmeiRelationDetail}
あなたの天中殺は${input.chusatsu}で、対象となる地支は${input.sanmeiRelations?.voidBranches.join('・') ?? '算出なし'}です。命式内での作用点は、**${tenchuAffected}**。天中殺は欠落や不幸の断定ではなく、その領域で既存の型に収まりにくく、経験を通じて独自の形を作りやすいという読み方をします。

【鑑定根拠 — 紫微斗数の十二宮・主星・四化・大限】
${input.ziwei?.available ? `出生地${input.ziwei.birthplace}、${input.ziwei.standardTimeNote}。旧暦は${input.ziwei.lunarDate}、出生時辰は${input.ziwei.time}（${input.ziwei.timeRange}）、${input.ziwei.fiveElementsClass}です。命主は**${input.ziwei.soul}**、身主は**${input.ziwei.body}**。命宮は${input.ziwei.earthlyBranchOfSoulPalace}、身宮は${input.ziwei.earthlyBranchOfBodyPalace}にあります。` : ''}
${ziweiPalaceDetail}
紫微斗数は一つの星だけで吉凶を断定せず、本宮・対宮・三方四正、四化、大限を重ねて読みます。ここでは命盤を固定計算し、各宮の主要テーマを表示しています。

【鑑定根拠 — 西洋占星術（トロピカル）】
${western ? `計算条件は${input.astrology?.method}。ASCは**${western.ascendant.sign}${western.ascendant.degree.toFixed(1)}°**で、第一印象と物事の始め方には「${ASTRO_SIGN[western.ascendant.sign]}」が表れます。
太陽${westernSun?.sign}は人生で育てる中心意識、月${westernMoon?.sign}は安心を感じる条件です。**太陽は「${ASTRO_SIGN[westernSun?.sign ?? ''] ?? '目的意識'}」、月は「${ASTRO_SIGN[westernMoon?.sign ?? ''] ?? '感情の反応'}」として働きます。**
${planetLine(western.planets, '西洋／トロピカル')}
主要アスペクト：${western.aspects.join('／') || '設定オーブ内に主要アスペクトなし'}。アスペクトは天体同士の力の使い方を示し、ソフト・ハードだけで吉凶を固定しません。` : input.astrology?.reason ?? '出生条件から算出できません。'}

【鑑定根拠 — インド占星術（ラヒリ・サイデリアル）】
${vedic ? `ラヒリ・アヤナーンシャ${vedic.ayanamsha.toFixed(3)}°を使用。ラグナは**${vedic.ascendant.sign}${vedic.ascendant.degree.toFixed(1)}°**、月は**${vedicMoon?.sign}**、太陽は**${vedicSun?.sign}**です。
**ラグナ（生き方の入口）：** ${ASTRO_SIGN[vedic.ascendant.sign]}。第一印象だけでなく、人生の課題へどう取り組むかを表します。
**太陽（目的意識）：** ${vedicSun?.sign}の「${ASTRO_SIGN[vedicSun?.sign ?? ''] ?? '自分の軸を育てる力'}」。社会の中で自分らしい責任を引き受ける方向です。
**月（心と習慣）：** ${vedicMoon?.sign}の「${ASTRO_SIGN[vedicMoon?.sign ?? ''] ?? '安心を作る力'}」。感情を落ち着かせ、日常を安定させる条件を示します。
月のナクシャトラは**${vedic.moonNakshatra}第${vedic.moonPada}パーダ**。「${NAKSHATRA_DETAIL[vedic.moonNakshatra] ?? '心の反応を経験へ変える力'}」が心の反応、習慣、縁の感じ方に現れます。パーダは同じナクシャトラ内での表現方法をさらに四分した位置です。
**水星（考え方・伝え方）：** ${vedicMercury?.sign}の「${ASTRO_SIGN[vedicMercury?.sign ?? ''] ?? '情報を扱う力'}」。
**金星（愛情・価値観）：** ${vedicVenus?.sign}の「${ASTRO_SIGN[vedicVenus?.sign ?? ''] ?? '関係を育てる力'}」。
**火星（行動・競争）：** ${vedicMars?.sign}${vedicMars?.retrograde ? '・逆行' : ''}の「${ASTRO_SIGN[vedicMars?.sign ?? ''] ?? '行動を起こす力'}」。逆行は力が弱いという意味ではなく、衝動や怒りを内側で検討してから出しやすい配置として扱います。
**木星（発展・学び）：** ${vedicJupiter?.sign}の「${ASTRO_SIGN[vedicJupiter?.sign ?? ''] ?? '可能性を広げる力'}」。
**土星（責任・成熟）：** ${vedicSaturn?.sign}の「${ASTRO_SIGN[vedicSaturn?.sign ?? ''] ?? '時間をかけて形にする力'}」。
${planetLine(vedic.planets, 'インド／サイデリアル')}
ここではラーシ（サイン）とナクシャトラを固定計算しています。ダシャーや分割図まで断定する場合は、出生時刻の誤差と出生地点を市区町村単位で確認する必要があります。` : input.astrology?.reason ?? '出生条件から算出できません。'}

【大運 — 10年ごとに変わる人生テーマ】
起運日は${input.timing?.startDate ?? '算出なし'}、運行は${input.timing?.direction ?? '算出なし'}です。大運は出来事そのものではなく、その10年間で使いやすくなる役割やテーマを表します。
${decadeDetail}

【婚期の候補 — 縁が動きやすい時期】
${marriageDetail}
**婚期は確定日ではなく、出会い・交際の進展・同居・婚約・結婚、または関係の見直しが起こりやすい候補です。** 配偶者星、日支との六合・冲、桃花、五行の補完が複数重なる年を抽出しています。特に「冲」は変化を示すため、結婚だけでなく別離や生活環境の変更として現れる場合もあります。

【年運 — 過去3年とこれから8年】
${annualDetail}
年運は立春前後で切り替わります。仕事・恋愛・結婚の判断は、この傾向だけで決めず、本人の希望、相手との関係、健康、資金、契約など現実条件を優先してください。

【宿曜詳細 — 本命宿の気質と対人傾向】
あなたの本命宿は**${input.sukuyo}宿**です。${sukuyoDetail}。
宿曜では本命宿だけで運命を断定せず、相手の宿との距離と関係分類を重ねて相性を見ます。単独鑑定では、${input.sukuyo}宿の長所を発揮できる環境と、感情・行動の偏りを確認するために使います。

【九星気学詳細 — 本命・月命・日命・時命】
本命星は**${input.kyuseiProfile?.yearStar ?? input.honmeiName}**です。${honmeiDetail}。
月命星は**${input.kyuseiProfile?.monthStar ?? '算出なし'}**で、内面や若年期に出やすい反応を補足します。日命星は${input.kyuseiProfile?.dayStar ?? '算出なし'}、${input.kyuseiProfile?.timeStar ? `時命星は${input.kyuseiProfile.timeStar}` : '出生時刻不明のため時命星は省略'}です。方位の吉凶は本命星だけで固定せず、移動する年月日の盤と目的地を別途重ねて判断します。

【数秘術詳細 — 運命数・誕生数・態度数・個人年】
運命数は**${input.lifePathNumber}（${NUMEROLOGY_DETAIL[input.lifePathNumber] ?? mission}）**で、人生全体では${mission}が中心テーマです。
誕生日の日付から見る誕生数は**${input.numerologyProfile?.birthDayNumber ?? '算出なし'}（${NUMEROLOGY_DETAIL[input.numerologyProfile?.birthDayNumber ?? 0] ?? '生まれ持った得意分野'}）**、月と日から見る態度数は**${input.numerologyProfile?.attitudeNumber ?? '算出なし'}（${NUMEROLOGY_DETAIL[input.numerologyProfile?.attitudeNumber ?? 0] ?? '第一印象と行動の入口'}）**です。${input.numerologyProfile ? `${input.numerologyProfile.personalYear}年の個人年は**${input.numerologyProfile.personalYearNumber}（${NUMEROLOGY_DETAIL[input.numerologyProfile.personalYearNumber] ?? '一年のテーマ'}）**です。` : ''}

【納音詳細 — 干支が示す自然界のイメージ】
あなたの納音は**${input.nayin}**です。${nayinDetail}。
納音は日柱の干支を二つ一組で分類する補助的な見方です。四柱推命の旺衰や通変星より優先して吉凶を決めず、**自分の資質をどのような環境で形にしやすいか**をイメージするために使います。

【運気を扱うときの注意】
あなたの天中殺は${input.chusatsu}です。これは不幸を予告するものではなく、従来の前提を見直しやすい周期を示す分類です。時期だけで重大な決断をせず、資金、健康、契約、周囲への影響といった現実条件を確認してください。**占術は決断を代行するものではなく、見落としている観点を増やす道具**です。

同じ出生データなら、同じ計算結果から読み解きます。出生時刻が不明な場合は時柱を含まないため、時刻を入力した結果より解釈の範囲が狭くなります。`
  */
}
