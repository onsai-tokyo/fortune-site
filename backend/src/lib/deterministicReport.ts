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
  astrology?: {
    available: boolean
    reason?: string
    method: string
    western?: {
      ascendant: { sign: string; degree: number }
      planets: Array<{ name: string; longitude: number; sign: string; degree: number; retrograde: boolean }>
      aspects: string[]
    }
    vedic?: {
      ayanamsha: number
      ascendant: { sign: string; degree: number }
      planets: Array<{ name: string; longitude: number; sign: string; degree: number; retrograde: boolean }>
      moonNakshatra: string
      moonPada: number
    }
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

const ASTRO_SIGN: Record<string, string> = {
  牡羊座: '自分から始め、率直に切り開く力', 牡牛座: '感覚と現実性を大切にし、価値を育てる力', 双子座: '情報を集め、言葉でつなぐ力', 蟹座: '身近な人を守り、安心できる場を作る力',
  獅子座: '創造性と誇りを表現し、周囲を照らす力', 乙女座: '細部を整え、役に立つ形へ改善する力', 天秤座: '複数の立場を調整し、美しい均衡を作る力', 蠍座: '一つの対象を深く掘り、根本から変える力',
  射手座: '視野を広げ、意味や可能性を探究する力', 山羊座: '目標を現実の仕組みへ変え、責任を果たす力', 水瓶座: '既存の枠を越え、独自の仕組みを考える力', 魚座: '境界を越えて感じ取り、想像力で包み込む力',
}

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
  const western = input.astrology?.western
  const vedic = input.astrology?.vedic
  const westernPlanet = (name: string) => western?.planets.find(planet => planet.name === name)
  const vedicPlanet = (name: string) => vedic?.planets.find(planet => planet.name === name)
  const planetLine = (planets: NonNullable<typeof western>['planets']) => planets.map(planet =>
    `${planet.name}：${planet.sign}${planet.degree.toFixed(1)}°${planet.retrograde ? '（逆行）' : ''}`
  ).join('／')
  const westernSun = westernPlanet('太陽')
  const westernMoon = westernPlanet('月')
  const westernVenus = westernPlanet('金星')
  const westernMars = westernPlanet('火星')
  const vedicSun = vedicPlanet('太陽')
  const vedicMoon = vedicPlanet('月')
  const vedicMercury = vedicPlanet('水星')
  const vedicVenus = vedicPlanet('金星')
  const vedicMars = vedicPlanet('火星')
  const vedicJupiter = vedicPlanet('木星')
  const vedicSaturn = vedicPlanet('土星')

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
  const rankedConsensus = [...signals.entries()]
    .map(([key, sources]) => ({ key, sources: [...sources], count: sources.size }))
    .filter(item => item.count >= 3)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  const supportingConsensus = [...signals.entries()]
    .map(([key, sources]) => ({ key, sources: [...sources], count: sources.size }))
    .filter(item => item.count === 2)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, 5)
  const selectedConsensus = rankedConsensus.length >= 2
    ? rankedConsensus
    : [...signals.entries()].map(([key, sources]) => ({ key, sources: [...sources], count: sources.size })).sort((a, b) => b.count - a.count).slice(0, 3)
  const strongest = selectedConsensus[0]
  const traitBlocks = selectedConsensus.map((item, index) => {
    const detail = consensusLabels[item.key]
    return `**${index + 1}. ${detail.title}**\n${detail.summary}\n${dailyTendencies[item.key]}\n**現実で活かす鍵：** ${detail.action}。\n一致した占術：${item.sources.join('・')}（${item.count}占術）`
  }).join('\n\n')
  const supportingBlocks = supportingConsensus.length
    ? supportingConsensus.map(item => `**${consensusLabels[item.key].title}** — ${consensusLabels[item.key].summary}\n根拠：${item.sources.join('・')}（2占術）`).join('\n\n')
    : '強い一致項目以外に、2占術で明確に重なる補助傾向はありません。'
  const workBlocks = selectedConsensus.map(item => `**${consensusLabels[item.key].title}：** ${consensusLabels[item.key].work}。${dailyTendencies[item.key]}`).join('\n\n')
  const loveBlocks = selectedConsensus.map(item => `**${consensusLabels[item.key].title}：** ${consensusLabels[item.key].love}。${friendTendencies[item.key]}`).join('\n\n')
  const actionBlocks = selectedConsensus.map((item, index) => `**${index + 1}. ${consensusLabels[item.key].action}**\nこの行動は「${consensusLabels[item.key].title}」を長所として使い、${shadowTendencies[item.key]}を防ぐためのものです。`).join('\n\n')
  const destinyBlocks = selectedConsensus.map(item => `**${consensusLabels[item.key].title}：** ${destinyTendencies[item.key]}。${dailyTendencies[item.key]}`).join('\n\n')
  const friendBlocks = selectedConsensus.map(item => `**${consensusLabels[item.key].title}：** ${friendTendencies[item.key]}`).join('\n\n')
  const shadowBlocks = selectedConsensus.map(item => `・**${consensusLabels[item.key].title}が過剰になると：** ${shadowTendencies[item.key]}`).join('\n')
  const personalYearSignals: Record<number, ConsensusKey[]> = { 1: ['initiative', 'independence'], 2: ['harmony', 'care'], 3: ['creativity', 'communication'], 4: ['stability', 'practicality'], 5: ['transformation', 'exploration'], 6: ['care', 'responsibility', 'harmony'], 7: ['insight', 'independence'], 8: ['responsibility', 'practicality'], 9: ['transformation', 'care'] }
  const annualSignals = (themes: string[]) => {
    const text = themes.join('、')
    const keys: ConsensusKey[] = []
    if (/発信|創作|挑戦/.test(text)) keys.push('communication', 'creativity', 'initiative')
    if (/成果|収入|現実/.test(text)) keys.push('practicality', 'responsibility')
    if (/責任|肩書|正式/.test(text)) keys.push('responsibility', 'stability')
    if (/学び|資格|支援/.test(text)) keys.push('exploration', 'insight')
    if (/自立|仲間|活動範囲|組み替え/.test(text)) keys.push('independence', 'transformation')
    if (/縁|まとまり/.test(text)) keys.push('harmony', 'stability')
    return [...new Set(keys)]
  }
  const basePersonalYear = input.numerologyProfile?.personalYearNumber
  const basePersonalYearCalendar = input.numerologyProfile?.personalYear ?? currentYear
  const timingBlocks = (input.timing?.annual ?? [])
    .filter(item => item.year >= currentYear && item.year <= currentYear + 7)
    .map(item => {
      const personalYear = basePersonalYear ? ((basePersonalYear - 1 + item.year - basePersonalYearCalendar) % 9 + 9) % 9 + 1 : null
      const shared = personalYear ? annualSignals(item.themes).filter(key => personalYearSignals[personalYear]?.includes(key)) : []
      if (!personalYear || !shared.length) return null
      const sharedLabels = shared.map(key => consensusLabels[key].title).join('・')
      const relationship = item.relationshipSignals.length && shared.some(key => ['harmony', 'stability', 'responsibility'].includes(key))
        ? ` 恋愛・結婚では${item.relationshipSignals.join('、')}が重なります。`
        : ''
      return `**${item.year}年（${item.ageRange}）：${sharedLabels}**\n四柱推命の年運「${item.themes.join('、')}」と数秘術の個人年${personalYear}が同じ方向を示します。${relationship}`
    })
    .filter((item): item is string => Boolean(item))
    .join('\n\n') || '今後7年間では、二つの時間運が明確に同じテーマを示す年はありません。出来事を無理に断定せず、生活上の変化を優先して判断してください。'

  // 「共通テーマ」は同じでも、実際の現れ方は命式・星図・天体の組み合わせで変わる。
  // 以下は入力ごとの実データを交差させ、テンプレートだけでは出ない個人差を文章化する層。
  const centerStarDetail = SANMEI_DETAIL[input.sanmeiStar] ?? sanmei
  const westStarDetail = LOVE_STYLE[westStar] ?? SANMEI_DETAIL[westStar] ?? sanmei
  const eastStarDetail = WORK_STYLE[eastStar] ?? SANMEI_DETAIL[eastStar] ?? sanmei
  const northStarDetail = SANMEI_DETAIL[northStar] ?? sanmei
  const southStarDetail = SANMEI_DETAIL[southStar] ?? sanmei
  const westernMoonDetail = ASTRO_SIGN[westernMoon?.sign ?? ''] ?? '感情を言葉と生活の両面から整える力'
  const westernVenusDetail = ASTRO_SIGN[westernVenus?.sign ?? ''] ?? '信頼できる価値観を育てる力'
  const westernMarsDetail = ASTRO_SIGN[westernMars?.sign ?? ''] ?? '意思を現実の行動へ変える力'
  const vedicMoonDetail = ASTRO_SIGN[vedicMoon?.sign ?? ''] ?? '日々の習慣から安心を作る力'
  const nakshatraDetail = NAKSHATRA_DETAIL[vedic?.moonNakshatra ?? ''] ?? '心の反応を経験へ変える力'
  const lifeNumberDetail = NUMEROLOGY_DETAIL[input.lifePathNumber] ?? mission
  const birthNumber = input.numerologyProfile?.birthDayNumber
  const attitudeNumber = input.numerologyProfile?.attitudeNumber
  const currentPhaseDetail = SUBORDINATE_DETAIL[currentPhase?.star ?? ''] ?? '現在の人生段階に必要な力を経験から育てる時期'
  const strongestDetail = ELEMENT_DETAIL[strongestElement] ?? '自然に使いやすい機能'
  const weakestDetail = ELEMENT_DETAIL[weakestElement] ?? '意識して補いたい機能'
  const primaryKey = selectedConsensus[0]?.key
  const secondaryKey = selectedConsensus[1]?.key
  const personalizedCore = `四柱推命の日主**${input.shichuDay[0]}**が示す「${day.core}」に、算命学の中心星**${input.sanmeiStar}**の「${centerStarDetail}」が重なります。つまり、外からは${day.strength}が見えやすい一方、内側では${centerStarDetail}を基準に納得できる形を探します。数秘術の運命数**${input.lifePathNumber}**は「${lifeNumberDetail}」を人生全体の課題にするため、能力を持っているだけでなく、${mission}へ結びつけたときに本人らしさが強く出ます。`
  const personalizedContrast = primaryKey && secondaryKey
    ? `あなたの個性は、**${consensusLabels[primaryKey].title}**と**${consensusLabels[secondaryKey].title}**を同時に持つ点にあります。${consensusLabels[primaryKey].summary}${consensusLabels[secondaryKey].summary} 一方だけを選ぶのではなく、「${consensusLabels[primaryKey].action}」の後に「${consensusLabels[secondaryKey].action}」という順番で使うと、内面の迷いを行動へ変えやすくなります。`
    : ''
  const personalizedEmotion = `西洋占星術の月**${westernMoon?.sign ?? '算出なし'}**は「${westernMoonDetail}」、インド占星術の月**${vedicMoon?.sign ?? '算出なし'}**とナクシャトラ**${vedic?.moonNakshatra ?? '算出なし'}**は「${vedicMoonDetail}」「${nakshatraDetail}」を示します。感情は一つの理由だけで動くというより、周囲との釣り合いと、自分の中で意味が通るかの両方を確認してから落ち着くタイプです。疲れているときは答えを急がず、まず感情を言葉にし、その後で事実を整理する順序が合います。`
  const personalizedElements = `五行では**${strongestElement}**が最も強く「${strongestDetail}」を自然に使えます。反対に**${weakestElement}**の「${weakestDetail}」は、能力がないという意味ではなく、環境・習慣・協力者によって補うほど全体が整う領域です。強い要素だけで突破し続けず、不足側を予定や仕組みに組み込むことが、この命式固有のバランス調整になります。`
  const personalizedLove = `算命学で配偶者との関係を表す西方は**${westStar}**で、「${westStarDetail}」という本人側の関係の築き方が出ます。これは相手本人を表す「配偶者星」とは区別して読みます。西洋占星術の金星**${westernVenus?.sign ?? '算出なし'}**は「${westernVenusDetail}」を愛情の価値基準にし、火星**${westernMars?.sign ?? '算出なし'}${westernMars?.retrograde ? '・逆行' : ''}**は「${westernMarsDetail}」として、欲しいものへ向かう際の反応を示します。さらに紫微斗数の夫妻宮は**${couplePalaceStars}**です。この組み合わせでは、単に優しい相手より、会話と行動が一致し、現実的な約束を更新できる相手かどうかが重要になります。`
  const personalizedWork = `算命学の社会位置は**${eastStar}**で「${eastStarDetail}」、紫微斗数の官禄宮は**${careerPalaceStars}**、財帛宮は**${wealthPalaceStars}**です。四柱推命の日主${input.shichuDay[0]}が持つ「${day.work}」への適性と合わせると、肩書だけで職業を選ぶより、**${eastStarDetail}を使いながら、${day.strength}を成果として確認できる仕事**で力が出ます。収入面では、得意なことを無制限に引き受けるより、担当範囲・納品物・対価を明確にするほど安定します。`
  const personalizedRelations = `算命学では、友人・社会との接点に**${eastStar}**、親・目上との関係に**${northStar}**、未来へ向けた表現に**${southStar}**が配置されています。友人には「${eastStarDetail}」が出やすく、目上の人には「${northStarDetail}」、後輩や守る相手には「${southStarDetail}」が出やすいため、相手によって別人のように振る舞う感覚があっても矛盾ではありません。すべての関係で同じ役を演じず、どの立場で何を引き受けるかを切り替える方が自然です。`
  const personalizedLifeStage = `${currentPhaseLabel}は**${currentPhase?.star ?? '算出なし'}**の「${currentPhaseDetail}」が表に出やすい段階です。現在の時間運は${currentTimingSummary || '算出された人生段階のテーマを確認する時期'}。生まれ持った資質をそのまま繰り返すのではなく、今の期間に求められる役割へ翻訳することが大切です。${birthNumber ? `誕生数${birthNumber}（${NUMEROLOGY_DETAIL[birthNumber] ?? '生得的な得意分野'}）` : ''}${attitudeNumber ? `と態度数${attitudeNumber}（${NUMEROLOGY_DETAIL[attitudeNumber] ?? '人から見えやすい入口'}）` : ''}も、現在の選択で最初に使いやすい方法を補足します。`
  const vedicDetailBlock = vedic
    ? `ラヒリ・アヤナーンシャ**${vedic.ayanamsha.toFixed(3)}°**を使ったサイデリアル方式です。出生地と出生時刻から算出したラグナは**${vedic.ascendant.sign}${vedic.ascendant.degree.toFixed(1)}°**です。

**ラグナ（生き方・外への現れ方）：** ${vedic.ascendant.sign}の「${ASTRO_SIGN[vedic.ascendant.sign] ?? '人生の課題へ現実的に取り組む力'}」。第一印象だけでなく、物事へ取り組む基本姿勢を表します。
**太陽（目的意識）：** ${vedicSun?.sign ?? '算出なし'}${vedicSun ? `${vedicSun.degree.toFixed(1)}°` : ''}。「${ASTRO_SIGN[vedicSun?.sign ?? ''] ?? '自分の軸と社会的な目的を育てる力'}」を人生の目的へ向けて育てます。
**月（心・習慣）：** ${vedicMoon?.sign ?? '算出なし'}${vedicMoon ? `${vedicMoon.degree.toFixed(1)}°` : ''}。「${vedicMoonDetail}」が安心の条件と感情の整え方に表れます。
**ナクシャトラ：** **${vedic.moonNakshatra} 第${vedic.moonPada}パーダ**。「${nakshatraDetail}」が、無意識の反応、縁の感じ方、習慣に現れます。
**水星（思考・伝達）：** ${vedicMercury?.sign ?? '算出なし'}${vedicMercury ? `${vedicMercury.degree.toFixed(1)}°` : ''}。「${ASTRO_SIGN[vedicMercury?.sign ?? ''] ?? '情報を整理して伝える力'}」。
**金星（愛情・価値観）：** ${vedicVenus?.sign ?? '算出なし'}${vedicVenus ? `${vedicVenus.degree.toFixed(1)}°` : ''}。「${ASTRO_SIGN[vedicVenus?.sign ?? ''] ?? '関係と価値を育てる力'}」。
**火星（行動・衝突時の反応）：** ${vedicMars?.sign ?? '算出なし'}${vedicMars ? `${vedicMars.degree.toFixed(1)}°` : ''}${vedicMars?.retrograde ? '・逆行' : ''}。「${ASTRO_SIGN[vedicMars?.sign ?? ''] ?? '意思を行動へ変える力'}」。逆行は弱さではなく、衝動を内側で検討してから表しやすい配置として読みます。
**木星（発展・学び）：** ${vedicJupiter?.sign ?? '算出なし'}${vedicJupiter ? `${vedicJupiter.degree.toFixed(1)}°` : ''}。「${ASTRO_SIGN[vedicJupiter?.sign ?? ''] ?? '経験から可能性を広げる力'}」。
**土星（責任・成熟）：** ${vedicSaturn?.sign ?? '算出なし'}${vedicSaturn ? `${vedicSaturn.degree.toFixed(1)}°` : ''}。「${ASTRO_SIGN[vedicSaturn?.sign ?? ''] ?? '時間をかけて責任を形にする力'}」。

**インド占星術から見る仕事：** ラグナの行動様式、木星の発展方向、土星の成熟課題を合わせ、短期的な職業名よりも、長期的に学びと責任を積み上げられる環境を重視します。
**インド占星術から見る恋愛：** 金星が求める価値と火星の行動反応に加え、月とナクシャトラが示す安心条件を確認します。強く惹かれるかだけでなく、日常で感情を安全に扱える関係かが重要です。

主要天体：${planetLine(vedic.planets)}

この欄はラーシ（サイン）、ラグナ、月のナクシャトラを表示しています。ダシャーや分割図は、出生地点を市区町村単位で確認してから扱う必要があるため、現在は断定表示していません。`
    : input.astrology?.reason ?? '出生時刻が不明なため、ラグナを含むインド占星術の詳細は算出していません。'

  return `【全占術一致鑑定 — 結論】
${strongest ? `複数の占術で最も強く一致したのは、**「${consensusLabels[strongest.key].title}」**です。` : '複数の占術を比較し、共通する傾向だけを抽出しました。'}
この鑑定書は、四柱推命・算命学・紫微斗数・宿曜・九星気学・数秘術・西洋占星術・インド占星術を比較し、**3種類以上で同じ方向が出た内容だけ**を表示しています。

【共通して現れた本質】
${traitBlocks}

【2つの占術で重なる補助傾向】
${supportingBlocks}
ここは3占術以上の「強い一致」より確度を一段下げた補足です。ただし、一つの占術だけの解釈より再現性があるため、日常で心当たりがある項目を強い一致と組み合わせて読んでください。

【この人固有の資質の組み合わせ】
${personalizedCore}

${personalizedContrast}

${personalizedEmotion}

${personalizedElements}

【この人固有の恋愛パターン】
${personalizedLove}

【インド占星術 — 個別結果】
${vedicDetailBlock}

【運命・人生で果たしやすい役割】
${destinyBlocks}
**人生の軸：自分の強みを自分だけの能力で終わらせず、人や社会が使える形にしたときに運命の共通テーマが完成します。**

【仕事の傾向・適した環境】
${personalizedWork}

${workBlocks}
**働き方：** 目的と評価基準は明確でありながら、進め方には自分の裁量がある環境が向きます。短期的な肩書より、上記の力を日常的に使える仕事内容を選ぶことが重要です。
**仕事での注意点：**\n${shadowBlocks}

【恋愛・結婚の傾向】
${loveBlocks}
**惹かれやすさ：** 会話や価値観に刺激がありながら、約束や生活面では信頼できる相手を求めます。
**恋の始まり方：** 相手の考え方や言葉の奥行きに関心を持ち、会話が重なるほど気持ちが深まりやすい傾向です。最初から感情だけで進むより、友人のような対話と信頼を経て関係が育つ方が本来の魅力を発揮できます。
**すれ違いやすい場面：** 相手を深く理解しようとするほど「言わなくても分かるはず」「確認すると関係を壊すかもしれない」と考えやすくなります。沈黙で調整せず、事実・気持ち・希望の順で短く伝えることが修復の鍵です。
**結婚相手を選ぶ基準：** 強い刺激だけでなく、問題が起きたときに話し合えるか、約束を行動で守るか、互いの仕事と一人の時間を尊重できるかを見てください。
**長続きの条件：** 気持ちを推測だけで決めず、連絡頻度、金銭感覚、仕事への理解、一人の時間を具体的に話せること。
**注意点：** 強く惹かれるかだけでなく、これらの条件を日常生活で守れる相手かを確認してください。

【友人・人間関係の傾向】
${personalizedRelations}

${friendBlocks}
**集団の中での役割：** 情報を整理して話を前へ進めたり、表面化していない違和感を見つけたりする役になりやすい人です。全員の感情まで管理しようとせず、論点を渡した後は相手の責任を残してください。
**相性のよい友人：** 好奇心があり、秘密や弱さを軽く扱わず、頻繁に会わなくても約束を守る人。意見が違っても質問し合える関係が長続きします。
**距離を置いた方がよい関係：** 曖昧な依頼を繰り返す人、相談だけして責任をすべて預ける人、あなたの一人の時間や境界線を尊重しない関係です。
**人間関係の結論：人数の多さより、互いの違いと境界線を尊重しながら、言葉と行動の両方で信頼を示せる関係が合います。**

【複数の時間運が重なる年】
${personalizedLifeStage}

${timingBlocks}
年の切り替わりは占術ごとに異なります。ここに表示する年は出来事の確定ではなく、二つ以上の時間運で同じ行動テーマが強まりやすい期間です。

【人生への具体的なアドバイス】
${actionBlocks}
**迷ったときの順序：** 自分の希望を言葉にする → 現実条件を数字で確認する → 小さく試す → 続けるか決める。この順序を守ると、共通して出ている強みを過不足なく使えます。

【この鑑定書に表示していないもの】
一つの占術だけに現れた特徴、他の占術と方向が一致しない解釈、根拠が2種類以下の内容は、混乱を避けるため表示していません。時期や出来事も、複数の異なる占術で同じテーマを固定計算できる場合を除き断定しません。

同じ生年月日・出生時刻・出生地・性別では、毎回同じ結果になります。占術は将来を保証するものではなく、自分の選択肢を整理するための参考情報として利用してください。`

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
${planetLine(western.planets)}
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
${planetLine(vedic.planets)}
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

同じ入力条件では常に同じ内容になります。出生時刻が不明な場合は時柱を含まないため、時刻を入力した結果より解釈の範囲が狭くなります。`
  */
}
