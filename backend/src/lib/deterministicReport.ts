interface ReportInput {
  shichuDay: string
  nayin: string
  sanmeiStar: string
  chusatsu: string
  sukuyo: string
  lifePathNumber: number
  honmeiName: string
  fourPillars?: Array<{ label: string; kanshi: string; stemTenGod: string; hiddenStems: Array<{ stem: string; tenGod: string }> }>
  elementBalance?: { scores: Record<string, number>; method: string }
  strength?: { label: string; supportRatio: number; favorableElements: string[]; note: string }
  sanmeiChart?: {
    bodyChart: Record<string, { label: string; star: string }>
    subordinateStars: Record<string, { label: string; star: string; stage: string }>
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

const LIFE_PATH: Record<number, string> = {
  1: '自分で始めること', 2: '人をつなぎ調和をつくること', 3: '喜びや発想を表現すること', 4: '確かな仕組みを築くこと',
  5: '変化を経験し自由を広げること', 6: '愛情と責任で場を整えること', 7: '本質を探究し知恵を深めること', 8: '現実的な成果と影響力を扱うこと',
  9: '広い視野で人や社会に還元すること', 11: '直感を言葉や創造へ変えること', 22: '大きな構想を現実の仕組みにすること', 33: '包容力を通して人を癒やし育てること',
}

export function buildDeterministicReport(input: ReportInput): string {
  const day = DAY_STEM[input.shichuDay[0]] ?? DAY_STEM.甲
  const sanmei = SANMEI[input.sanmeiStar] ?? '資質を着実に活かす力'
  const mission = LIFE_PATH[input.lifePathNumber] ?? LIFE_PATH[1]
  const pillarDetail = input.fourPillars?.map(pillar =>
    `${pillar.label}${pillar.kanshi}：天干=${pillar.stemTenGod}、蔵干=${pillar.hiddenStems.map(item => `${item.stem}（${item.tenGod}）`).join('・')}`
  ).join('\n') ?? '出生データから詳細命式を算出できませんでした。'
  const elementDetail = input.elementBalance
    ? Object.entries(input.elementBalance.scores).map(([element, score]) => `${element}${score}`).join('・')
    : '算出なし'
  const bodyChartDetail = input.sanmeiChart
    ? Object.values(input.sanmeiChart.bodyChart).map(item => `${item.label}=${item.star}`).join('、')
    : '算出なし'
  const subordinateDetail = input.sanmeiChart
    ? Object.values(input.sanmeiChart.subordinateStars).map(item => `${item.label}=${item.star}（${item.stage}）`).join('、')
    : '算出なし'

  return `【性格特性 — あなたの本質と気質】
あなたの中心には、**${day.core}**という性質があります。最大の強みは、${day.strength}です。算命学の${input.sanmeiStar}が示す${sanmei}も重なるため、自分の資質を発揮できる環境では周囲に明確な影響を与えます。注意点は、${day.caution}です。得意な方法だけに頼らず、別の視点を取り入れるほど本来の強みが安定します。

【四柱推命詳細 — 通変星・蔵干・五行バランス】
${pillarDetail}
五行バランスは **${elementDetail}** です（${input.elementBalance?.method ?? '簡易集計'}）。月令を加味した扶助比率は${input.strength?.supportRatio ?? '-'}%で、判定は **${input.strength?.label ?? '算出なし'}**。補いやすい五行の目安は${input.strength?.favorableElements.join('・') ?? '算出なし'}です。これは格局や調候まで含めた喜神・忌神の断定ではなく、五行の偏りを見るための補助指標です。

【算命学詳細 — 人体星図・十二大従星】
十大主星の人体星図は、${bodyChartDetail}です。十二大従星は、${subordinateDetail}です。中央の星だけで性格を固定せず、場所ごとの役割と人生段階を合わせて読みます。

【周りから見たあなた — 外面と内面のギャップ】
周囲からは、${sanmei}を備えた人として見られやすい傾向があります。内側では表面上の印象より深く状況を観察しています。**外から期待される役割と、自分が守りたい感覚を分けること**が人間関係の鍵です。判断の理由を短い言葉で共有すると誤解が減ります。

【仕事・適職 — 才能が開花する環境と職種】
適性が活きる分野は、**${day.work}**です。職種名そのものより、${day.strength}を使えるかどうかが重要です。${input.honmeiName}の性質は、社会の中で自分の役割を形にする際の補助線になります。裁量の範囲、成果の基準、協力相手が明確な環境を選ぶと力が安定します。

【恋愛とパートナーシップ】
あなたが安心を感じやすいのは、**${day.love}**です。相手に合わせることだけを愛情にせず、互いの違いを確認できる関係が長続きします。相性は生年月日だけで断定せず、二人の命式と実際の対話を合わせて判断します。

【人生の使命 — 生まれ持ったテーマ】
数秘術の運命数${input.lifePathNumber}が示す中心テーマは、**${mission}**です。宿曜の${input.sukuyo}宿と算命学の${sanmei}を組み合わせると、培った力を周囲へ渡したときに人生の手応えが強まります。大きな目標ほど、小さく再現できる行動へ分解することが使命を現実へつなぐ方法です。

【運気を扱うときの注意】
あなたの天中殺は${input.chusatsu}です。これは不幸を予告するものではなく、従来の前提を見直しやすい周期を示す分類です。時期だけで重大な決断をせず、資金、健康、契約、周囲への影響といった現実条件を確認してください。**占術は決断を代行するものではなく、見落としている観点を増やす道具**です。

【統合結果】
四柱推命の日柱${input.shichuDay}、納音${input.nayin}、算命学の${input.sanmeiStar}、宿曜の${input.sukuyo}宿、運命数${input.lifePathNumber}、九星気学の${input.honmeiName}を統合すると、あなたの軸は**${day.core}として、${mission}**にあります。同じ入力条件では常に同じ内容になります。出生時刻が不明な場合は時柱を含まないため、時刻を入力した結果より解釈の範囲が狭くなります。`
}
