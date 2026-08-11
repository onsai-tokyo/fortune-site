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
}
