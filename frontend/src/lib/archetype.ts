// 60干支アーキタイプ（動物占いを参考にした性格傾向 — AI参照用、UIには表示しない）
// 10天干 × 12地支 = 60通りの命主（日柱）パターン

const STEM_ELEMENT: Record<string, string> = {
  甲: '木陽', 乙: '木陰', 丙: '火陽', 丁: '火陰',
  戊: '土陽', 己: '土陰', 庚: '金陽', 辛: '金陰',
  壬: '水陽', 癸: '水陰',
}

const BRANCH_ARCHETYPE: Record<string, { group: string; core: string }> = {
  子: { group: 'チーター型', core: '直感的・独立心強・スピード重視・感情を隠す' },
  丑: { group: 'たぬき型',   core: '粘り強い・現実的・愛着心・変化を嫌う' },
  寅: { group: 'ライオン型', core: '大胆・カリスマ・プライド高い・実行力' },
  卯: { group: 'コアラ型',   core: '温厚・人懐っこい・平和主義・依存傾向' },
  辰: { group: 'タヌキ型',   core: '器用・社交的・本音を隠す・広浅交際' },
  巳: { group: 'ペガサス型', core: '直感鋭い・浮世離れ・理想主義・二面性' },
  午: { group: '狼型',       core: '二面性・孤独を好む・信頼した人だけに深く懐く・表と裏がある' },
  未: { group: '羊型',       core: '繊細・共感力高い・流されやすい・芸術的感性' },
  申: { group: '猿型',       core: '器用・好奇心旺盛・要領がいい・集中力にムラ' },
  酉: { group: '鳥型',       core: '完璧主義・美意識高い・こだわり強い・批判的' },
  戌: { group: '犬型',       core: '誠実・義理堅い・一途・頑固な一面' },
  亥: { group: '猪型',       core: '一本気・突進力・情熱的・細かいことを気にしない' },
}

const ELEMENT_TONE: Record<string, string> = {
  木陽: '積極的・外向き・リーダーシップを取りたがる',
  木陰: '柔軟・協調性・環境に合わせる適応力',
  火陽: '情熱的・表現力豊か・行動力・飽きやすい',
  火陰: '感受性豊か・直感的・慎重・深く考える',
  土陽: '安定志向・誠実・継続力・変化を嫌う',
  土陰: '慎重・内向き・蓄積を好む・信頼を重視',
  金陽: '論理的・決断力・義理堅い・ストイック',
  金陰: '完璧主義・繊細・美的センス・プライド高い',
  水陽: '自由・適応力・流れに乗る・飄々とした印象',
  水陰: '感受性・直感・内省的・神秘的な魅力',
}

export function getArchetype(kanshi: string): string {
  if (!kanshi || kanshi.length < 2) return ''
  const stem = kanshi[0]
  const branch = kanshi[1]
  const element = STEM_ELEMENT[stem] ?? ''
  const branchInfo = BRANCH_ARCHETYPE[branch]
  const elementTone = ELEMENT_TONE[element] ?? ''
  if (!branchInfo) return ''
  return `日柱アーキタイプ（${branchInfo.group}・${element}）：${branchInfo.core}。気質トーン：${elementTone}`
}

// 宿曜27宿の詳細特徴（年運・性格参照用）
export const SUKUYO_DETAIL: Record<string, { character: string; yearNote: string }> = {
  昴: { character: '完璧主義・孤高・少数精鋭の深い縁・周囲との摩擦あり', yearNote: '試練と達成が同時に来る年。結果が出やすい' },
  畢: { character: '安定志向・実務能力高い・堅実・家族への愛着', yearNote: '土台固めに向く年。急激な変化より積み上げが吉' },
  觜: { character: '多才・知性・飽きやすい・コミュニケーション上手', yearNote: '情報収集と学びに向く。横展開が鍵' },
  参: { character: '行動力・開拓精神・衝突しやすい・正義感', yearNote: '挑戦に向く年。ただし衝突に注意' },
  井: { character: '人情厚い・浮き沈みある・感受性・芸能センス', yearNote: '感情の波が激しい年。人間関係に動きあり' },
  鬼: { character: '神秘的・先見の明・恐れられやすい・霊的感受性', yearNote: '見えないものに気づく年。直感を信じるべき時' },
  柳: { character: '繊細・流されやすい・芸術的・頑固な核がある', yearNote: '流れに乗ることが重要。逆らうと消耗する' },
  星: { character: 'カリスマ・目立ちたがり・孤独感・高い理想', yearNote: '表舞台に立つ機会あり。自己表現の年' },
  張: { character: '社交的・華やか・見栄っ張り・実力者', yearNote: '人脈が広がる年。外向きの活動が吉' },
  翼: { character: '博識・旅好き・自由人・腰が重い', yearNote: '遠出・旅・新しい知識との出会いに向く年' },
  軫: { character: '誠実・縁の下の力持ち・感受性・縁が深い', yearNote: '縁をつなぐ年。目立たないが重要なポジション' },
  角: { character: '完璧主義・正義感・批判的・改革者', yearNote: '仕組みを変える機会の年。変革に向く' },
  亢: { character: '論理的・頑固・自律・慎重', yearNote: '熟慮する年。焦らず準備を固める' },
  氐: { character: '平和主義・調整役・優柔不断・共感力', yearNote: '調和を保つ年。決断より調整が成功の鍵' },
  房: { character: '行動力・決断力・束縛嫌い・波乱万丈', yearNote: '動きのある年。決断のタイミングが重要' },
  心: { character: '二面性・鋭い洞察力・深い情・わかってくれる人だけに懐く・心に闇を抱える', yearNote: '内面の整理が必要な年。表と裏の統合がテーマ' },
  尾: { character: '包容力・粘り強さ・多産的・欲深い面', yearNote: '蓄積と結実の年。コツコツが実を結ぶ' },
  箕: { character: '批判精神・こだわり強い・頭脳明晰・反骨心', yearNote: '自己表現の年。批判より建設的提案が吉' },
  斗: { character: '現実的・几帳面・秘密主義・信頼される', yearNote: '地道な積み上げが報われる年' },
  女: { character: '社交的・気配り・少々計算高い・美意識', yearNote: '人間関係が活発になる年。縁が動く' },
  虚: { character: '独特の世界観・孤独好き・霊感・不思議な魅力', yearNote: '自分の世界を深める年。外より内に向く' },
  危: { character: '慎重・心配性・準備周到・繊細', yearNote: '備えの年。リスク管理と予防が大事' },
  室: { character: '包容力・スケール大きい・浪費傾向・カリスマ', yearNote: '大きな縁やチャンスが来る年。準備次第で大きく変わる' },
  壁: { character: '堅実・保守的・信頼の厚さ・変化に鈍感', yearNote: '守りの年。現状維持が最善の場合も' },
  奎: { character: '独創的・芸術的・変人気質・強烈な個性', yearNote: '個性が評価される年。独自路線で進む' },
  婁: { character: '調停者・誠実・愛情深い・見返りを求める', yearNote: '対人関係が鍵の年。信頼を築く行動が吉' },
  胃: { character: '現実的・蓄財上手・執着心・食い意地', yearNote: '財運の年。資産を増やす行動に向く' },
}

export function getSukuyoDetail(sukuyo: string): string {
  const detail = SUKUYO_DETAIL[sukuyo]
  if (!detail) return ''
  return `宿曜（${sukuyo}宿）詳細：性格傾向「${detail.character}」。今年の年運傾向「${detail.yearNote}」`
}
