interface ReportInput {
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
    annual: Array<{ year: number; ageRange: string; kanshi: string; tenGod: string; score: number; relationshipSignals: string[]; themes: string[] }>
    marriageCandidates: Array<{ year: number; ageRange: string; kanshi: string; tenGod: string; score: number; relationshipSignals: string[]; themes: string[] }>
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
  }
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
  牽牛星: '誠実さと将来性を重視し、正式な関係を丁寧に築くタイプ',
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
    ? input.ziwei.palaces?.map(palace => {
        const major = palace.majorStars.length
          ? palace.majorStars.map(star => `${star.name}${star.brightness ? `（${star.brightness}）` : ''}${star.mutagen ? `・化${star.mutagen}` : ''}：${star.detail}`).join('／')
          : '主星なし（対宮と三方四正を合わせて読みます）'
        const minor = palace.minorStars.slice(0, 4).join('・') || 'なし'
        return `**${palace.name}${palace.isBodyPalace ? '［身宮］' : ''}（${palace.heavenlyStem}${palace.earthlyBranch}）：** ${major}。主な補助星は${minor}。大限${palace.decadal.range?.join('〜') ?? '算出なし'}歳。`
      }).join('\n')
    : input.ziwei?.reason ?? '出生時刻がないため算出できません。'

  return `【性格特性 — あなたの本質と気質】
あなたの中心には、**${day.core}**という性質があります。日主${input.shichuDay[0]}は、状況に対する基本姿勢を表します。
**最大の強み：${day.strength}。** 算命学の中心星${input.sanmeiStar}が示す${sanmei}も重なるため、自分の資質を発揮できる環境では周囲に明確な影響を与えます。
**注意点：${day.caution}。** 得意な方法だけに頼らず、別の視点を取り入れるほど本来の強みが安定します。

【四柱推命詳細 — 通変星・蔵干・五行バランス】
${pillarDetail}
五行バランスは${elementDetail}です（${input.elementBalance?.method ?? '簡易集計'}）。最も強い${strongestElement}は「${ELEMENT_DETAIL[strongestElement] ?? '固有の働き'}」が自然に使いやすい一方、最も少ない${weakestElement}は意識的に補う余地があります。
月令を加味した扶助比率は${input.strength?.supportRatio ?? '-'}%で、**旺衰の簡易判定は${input.strength?.label ?? '算出なし'}**です。**補う五行の目安は${input.strength?.favorableElements.join('・') ?? '算出なし'}**。これは格局や調候まで含めた喜神・忌神の断定ではなく、五行の偏りを見るための補助指標です。

【算命学詳細 — 人体星図・十二大従星】
${bodyChartDetail}
**中心星${input.sanmeiStar}の要点は、${sanmei}です。** 中央だけで性格を固定せず、北・西・東・南で異なる場面の表れ方も合わせて読みます。

十二大従星は、人生段階ごとのエネルギーの使い方を表します。
${subordinateDetail}

【周りから見たあなた — 外面と内面のギャップ】
周囲からは、${sanmei}を備えた人として見られやすい傾向があります。内側では表面上の印象より深く状況を観察しています。**人間関係の鍵は、外から期待される役割と、自分が守りたい感覚を分けること。** 判断の理由を短い言葉で共有すると誤解が減ります。

【算命学詳細 — 位相法と天中殺の作用点】
${sanmeiRelationDetail}
あなたの天中殺は${input.chusatsu}で、対象となる地支は${input.sanmeiRelations?.voidBranches.join('・') ?? '算出なし'}です。命式内での作用点は、**${tenchuAffected}**。天中殺は欠落や不幸の断定ではなく、その領域で既存の型に収まりにくく、経験を通じて独自の形を作りやすいという読み方をします。

【紫微斗数 — 十二宮・主星・四化・大限】
${input.ziwei?.available ? `出生地${input.ziwei.birthplace}、${input.ziwei.standardTimeNote}。旧暦は${input.ziwei.lunarDate}、出生時辰は${input.ziwei.time}（${input.ziwei.timeRange}）、${input.ziwei.fiveElementsClass}です。命主は**${input.ziwei.soul}**、身主は**${input.ziwei.body}**。命宮は${input.ziwei.earthlyBranchOfSoulPalace}、身宮は${input.ziwei.earthlyBranchOfBodyPalace}にあります。` : ''}
${ziweiPalaceDetail}
紫微斗数は一つの星だけで吉凶を断定せず、本宮・対宮・三方四正、四化、大限を重ねて読みます。ここでは命盤を固定計算し、各宮の主要テーマを表示しています。

【仕事・適職 — 才能が開花する環境と職種】
東方の${eastStar}は社会へ向かう行動に${SANMEI[eastStar] ?? '固有の強み'}が出やすいことを示します。仕事では、${WORK_STYLE[eastStar] ?? '自分の資質を活かせる働き方'}が成果につながります。南方の${southStar}は、部下や顧客へ働きかける際に${SANMEI[southStar] ?? '持ち味'}を使う傾向です。
**適性が活きる分野：${day.work}。** 職種名そのものより、${day.strength}を使えるかどうかが重要です。${input.honmeiName}の性質も、社会の中で役割を形にする際の補助線になります。
働く環境は、裁量の範囲、成果の基準、協力相手が明確であるほど安定します。苦手な${weakestElement}の働き（${ELEMENT_DETAIL[weakestElement] ?? '不足しやすい機能'}）は、仕組み化や得意な人との協力で補うと無理がありません。

【恋愛 — 好きになり方と関係の育て方】
西方（右手）の${westStar}は、恋愛や身近なパートナーとの関わり方を表します。あなたは、${LOVE_STYLE[westStar] ?? '信頼を少しずつ育てるタイプ'}です。日主${input.shichuDay[0]}の性質から、気持ちが動いても自分なりに状況を整理してから関係へ踏み込む傾向があります。
**恋愛で安心を感じやすいのは、${day.love}。** 相手に合わせることだけを愛情にせず、希望や不安を短い言葉で共有すると関係が安定します。${westStar}の長所が強く出すぎたときは、自分のペースだけで進めず、相手の希望も具体的に確認してください。

【結婚 — 長く暮らすための相性と課題】
結婚生活では、恋愛感情に加えて生活の分担、金銭感覚、一人で回復する時間を先に話し合うことが重要です。西方の${westStar}が示す${SANMEI[westStar] ?? '関係性の特徴'}を夫婦関係で発揮しやすいため、相手には「察してもらう」より、自分が守りたい日常を具体的に伝える方が合います。
**結婚を安定させる鍵は、互いの自由と約束の範囲を明確にすること。** 五行で少ない${weakestElement}の役割をどちらが担うか決めておくと、負担の偏りを減らせます。結婚時期や特定の相手との相性は、本人だけの命式では断定せず、二人分の命式と実際の状況を合わせて見ます。

【過去の傾向 — 初年期に身につけたもの】
北方の${northStar}は、親・目上との関係や思考の土台に${SANMEI[northStar] ?? '固有の性質'}が現れやすいことを示します。初年期の${earlyStar?.star ?? '従星'}（${earlyStar?.stage ?? '十二運'}）は、${SUBORDINATE_DETAIL[earlyStar?.star ?? ''] ?? '環境から受け取った経験を自分の力へ変える傾向'}です。
**過去から受け継いだ強みは、${day.strength}。** 一方で、当時の環境に適応するために身につけた反応を、現在も必要以上に続けていないか確認すると選択肢が増えます。ここで示すのは出来事の断定ではなく、年柱と初年期の星から見た感じ方・行動の傾向です。

【現在から未来 — エネルギーの移り変わり】
${currentPhaseLabel}は${currentPhase?.star ?? '中年期の従星'}（${currentPhase?.stage ?? '十二運'}）の性質である「${SUBORDINATE_DETAIL[currentPhase?.star ?? ''] ?? '現在の役割に必要な力を育てること'}」がテーマになりやすい段階です。中年期の${middleStar?.star ?? '従星'}は仕事・家庭・社会的役割、晩年期の${lateStar?.star ?? '従星'}は経験をどう自分らしく活かすかに関係します。
未来へ向かう南方の${southStar}は、${SANMEI[southStar] ?? '次の世代や周囲へ自分の力を渡す性質'}を示します。**未来の方向性は、${WORK_STYLE[southStar] ?? '自分の経験を周囲へ還元すること'}。** 急いで結果を当てにいくより、現在の強みを繰り返せる形にするほど次の段階へつながります。
ここまでは人生段階を示す固定鑑定です。以下では、大運・年運を重ねて具体的な時期を確認します。

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

【人生の使命 — 生まれ持ったテーマ】
数秘術の運命数${input.lifePathNumber}が示す中心テーマは、**${mission}**です。宿曜の${input.sukuyo}宿と算命学の${sanmei}を組み合わせると、培った力を周囲へ渡したときに人生の手応えが強まります。大きな目標ほど、小さく再現できる行動へ分解することが使命を現実へつなぐ方法です。

【運気を扱うときの注意】
あなたの天中殺は${input.chusatsu}です。これは不幸を予告するものではなく、従来の前提を見直しやすい周期を示す分類です。時期だけで重大な決断をせず、資金、健康、契約、周囲への影響といった現実条件を確認してください。**占術は決断を代行するものではなく、見落としている観点を増やす道具**です。

【統合結果】
四柱推命の日柱${input.shichuDay}、納音${input.nayin}、算命学の${input.sanmeiStar}、宿曜の${input.sukuyo}宿、運命数${input.lifePathNumber}、九星気学の${input.honmeiName}を統合すると、**あなたの軸は「${day.core}として、${mission}」にあります。** 強みを再現できる環境を選び、少ない五行を習慣や協力者で補うことが、命式を現実へ活かす方法です。同じ入力条件では常に同じ内容になります。出生時刻が不明な場合は時柱を含まないため、時刻を入力した結果より解釈の範囲が狭くなります。`
}
