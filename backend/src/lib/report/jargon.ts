/**
 * 占術用語の辞書と平易語対応。
 *
 * 【設計方針】
 * 用語は「削除する」のではなく「降ろす」。3層に配置する。
 *   1. 本文（Claim.subject / proposition / behavior）→ 生活語のみ。JARGON_TERMS を1語も含めない
 *   2. 根拠（Claim.evidence[].detail）        → 専門用語のまま残す
 *   3. 用語集（Claim.termGloss）              → 用語 + 平易な説明。命式詳細タブで開く
 *
 * 実測（40サンプル / 10,312ページ）:
 *   essence章 0/4,800 = 0.0%   ← 本質章に用語は入っていない
 *   timing章  1,703/5,512 = 30.9% ← 混入は全部ここ
 * つまり本文からの除去対象は timingCards.ts のみである。
 *
 * 【注意】
 * '冲' '刑' '害' '破' は単字のため誤検知しうる。
 * 誤検知が出ても辞書から外さず、本文側でその語を含む表現を避けること。
 * 辞書を緩めると混入が指標に出なくなる。
 */

export type JargonSystem =
  | '四柱推命' | '算命学' | '紫微斗数' | '西洋占星術' | 'インド占星術'
  | '九星気学' | '数秘術' | '宿曜' | '納音'

export interface TermGloss {
  /** 専門用語。本文には出さない */
  term: string
  /** 生活語の説明。1文。断定を避け、占術的主張をしない */
  plain: string
  system: JargonSystem
}

/**
 * 用語 → 平易語。
 * 出典は lib/divination/index.ts の既存記述と rules/PERSONALITY_RULES.md。
 * ★新規に意味を発明していない。追加する場合も必ず出典を持つこと。
 */
export const TERM_GLOSSARY: readonly TermGloss[] = [
  // ── 四柱推命：干支関係 ──────────────────────────────
  { term: '干合', plain: '二つの性質が強く引き合い、どちらとも違う第三の働きに変わること', system: '四柱推命' },
  { term: '支合', plain: '二つの要素が結びつき、離れにくい関係になること', system: '四柱推命' },
  { term: '三合', plain: '三つの要素がそろって、一つの大きな方向へまとまること', system: '四柱推命' },
  { term: '方合', plain: '同じ季節の要素が集まり、一つの傾向が強く出ること', system: '四柱推命' },
  { term: '冲', plain: '向かい合う二つがぶつかり、いまの形が動きやすくなること', system: '四柱推命' },
  { term: '刑', plain: '近い関係ほど、互いへの要求が厳しくなりやすい組み合わせ', system: '四柱推命' },
  { term: '害', plain: '言葉にならない小さな引っかかりが溜まりやすい組み合わせ', system: '四柱推命' },
  { term: '破', plain: '一度できあがった形が、途中で崩れて作り直しになりやすい組み合わせ', system: '四柱推命' },
  { term: '天中殺', plain: '努力の結果が出るまでに時間がかかりやすく、種まきに向く時期', system: '算命学' },
  { term: '空亡', plain: '天中殺と同じ考え方。結果を急がず整える時期を指す', system: '四柱推命' },

  // ── 四柱推命：命式の部位 ────────────────────────────
  { term: '日干', plain: '生まれた日から取り出す、その人の中心になる要素', system: '四柱推命' },
  { term: '日支', plain: '生まれた日から取り出す、近い関係や生活を表す要素', system: '四柱推命' },
  { term: '月干', plain: '生まれた月から取り出す、社会での立ち位置を表す要素', system: '四柱推命' },
  { term: '月支', plain: '生まれた月から取り出す、育った環境や才能の土台を表す要素', system: '四柱推命' },
  { term: '年支', plain: '生まれた年から取り出す、家族や出身の背景を表す要素', system: '四柱推命' },
  { term: '天干', plain: '命式の上段。外へ出る性質を表す', system: '四柱推命' },
  { term: '地支', plain: '命式の下段。内側や生活の実感を表す', system: '四柱推命' },
  { term: '蔵干', plain: '地支の中に隠れている性質。表からは見えにくい面を表す', system: '四柱推命' },
  { term: '通変星', plain: '中心の要素と他の要素の関係から読む、行動の傾向', system: '四柱推命' },
  { term: '配偶者星', plain: '結婚相手との縁の出やすさを見るための要素', system: '四柱推命' },

  // ── 四柱推命：十神 ─────────────────────────────────
  { term: '比肩', plain: '自分の考えで動き、人に合わせすぎない働き', system: '四柱推命' },
  { term: '劫財', plain: '人と並んだときに力が出る、競い合いの働き', system: '四柱推命' },
  { term: '食神', plain: '楽しみを育て、周囲へ広げていく働き', system: '四柱推命' },
  { term: '傷官', plain: '違和感を見逃さず、言葉にして作り直す働き', system: '四柱推命' },
  { term: '偏財', plain: '人との接点を増やし、動かす範囲を広げる働き', system: '四柱推命' },
  { term: '正財', plain: '暮らしの基準を整え、確かな形に残す働き', system: '四柱推命' },
  { term: '偏官', plain: '難しい役割へ踏み込み、突破口を作る働き', system: '四柱推命' },
  { term: '正官', plain: '任された範囲を守り、信頼を形にする働き', system: '四柱推命' },
  { term: '偏印', plain: '見慣れない方法を試し、発想を切り替える働き', system: '四柱推命' },
  { term: '印綬', plain: '受け取った知恵を深め、次へ受け渡す働き', system: '四柱推命' },

  // ── 算命学：十大主星 ───────────────────────────────
  { term: '貫索星', plain: '自分の決めた順序を守り抜く性質', system: '算命学' },
  { term: '石門星', plain: '違う人同士のあいだを整え、輪を作る性質', system: '算命学' },
  { term: '鳳閣星', plain: '感じたことを自然な形で表に出す性質', system: '算命学' },
  { term: '調舒星', plain: '小さな変化を言葉より先に感じ取る性質', system: '算命学' },
  { term: '禄存星', plain: '相手が必要とするものを見つけて手渡す性質', system: '算命学' },
  { term: '司禄星', plain: '変化の中でも続けられる形を作る性質', system: '算命学' },
  { term: '車騎星', plain: '最初の一歩を引き受けて動き出す性質', system: '算命学' },
  { term: '牽牛星', plain: '役割と責任を明確にして力を保つ性質', system: '算命学' },
  { term: '龍高星', plain: 'まだ知らないものへ向かう好奇心が強い性質', system: '算命学' },
  { term: '玉堂星', plain: '経験を知識へ変えて残していく性質', system: '算命学' },

  // ── 算命学：十二大従星 ─────────────────────────────
  { term: '天将星', plain: 'エネルギーの出方が最も大きい時期・場面を表す', system: '算命学' },
  { term: '天禄星', plain: '安定して力を出し続けやすい状態を表す', system: '算命学' },
  { term: '天南星', plain: '勢いよく前へ出やすい状態を表す', system: '算命学' },
  { term: '天貴星', plain: '素直に受け取り、育っていく状態を表す', system: '算命学' },
  { term: '天堂星', plain: '経験を落ち着いて扱える状態を表す', system: '算命学' },
  { term: '天恍星', plain: '感受性が高く、揺れやすい状態を表す', system: '算命学' },
  { term: '天印星', plain: '周囲から受け取ることで力が回る状態を表す', system: '算命学' },
  { term: '天庫星', plain: '内側へ深く掘り下げていく状態を表す', system: '算命学' },
  { term: '天胡星', plain: '休みながら整えることが必要な状態を表す', system: '算命学' },
  { term: '天報星', plain: '方向が定まりきらず、可能性が広い状態を表す', system: '算命学' },
  { term: '天極星', plain: '一度手放して作り直しやすい状態を表す', system: '算命学' },
  { term: '天馳星', plain: '短く強く動いて切り替わる状態を表す', system: '算命学' },

  // ── 運の周期 ────────────────────────────────────
  { term: '大運', plain: '約10年ごとに切り替わる、長い流れの区切り', system: '四柱推命' },
  { term: '流年', plain: 'その年ごとに移り変わる、短い流れ', system: '四柱推命' },
  { term: '納音', plain: '生まれた日の組み合わせを、自然の情景になぞらえて読む見方', system: '納音' },

  // ── 紫微斗数 ────────────────────────────────────
  { term: '紫微', plain: '中心に立って全体を引き受ける働きを表す星', system: '紫微斗数' },
  { term: '天府', plain: '蓄えて安定させる働きを表す星', system: '紫微斗数' },
  { term: '武曲', plain: '現実の条件を積み上げて形にする働きを表す星', system: '紫微斗数' },
  { term: '天相', plain: 'あいだを取り持ち、場を整える働きを表す星', system: '紫微斗数' },
  { term: '天機', plain: '表面の奥にある理由を読み取る働きを表す星', system: '紫微斗数' },
  { term: '巨門', plain: '言葉にして人へ渡す働きを表す星', system: '紫微斗数' },
  { term: '太陽', plain: '外へ向けて広げ、照らす働きを表す星', system: '紫微斗数' },
  { term: '太陰', plain: '内側で受け取り、細やかに感じ取る働きを表す星', system: '紫微斗数' },
  { term: '七殺', plain: '難所へ踏み込んで切り開く働きを表す星', system: '紫微斗数' },
  { term: '破軍', plain: '古い形を終わらせて作り直す働きを表す星', system: '紫微斗数' },
  { term: '廉貞', plain: '自分の基準を通す働きを表す星', system: '紫微斗数' },
  { term: '貪狼', plain: '知らないものへ向かって広げる働きを表す星', system: '紫微斗数' },
  { term: '化禄', plain: 'その領域で、恵まれ方や広がりが出やすくなる印', system: '紫微斗数' },
  { term: '化権', plain: 'その領域で、任される範囲や決定権が増えやすくなる印', system: '紫微斗数' },
  { term: '化科', plain: 'その領域で、評価や名前が出やすくなる印', system: '紫微斗数' },
  { term: '化忌', plain: 'その領域だけ、こだわりや振れ幅が大きくなりやすい印', system: '紫微斗数' },
  { term: '命宮', plain: '本人そのものを表す区画', system: '紫微斗数' },
  { term: '夫妻宮', plain: '結婚相手や近い関係を表す区画', system: '紫微斗数' },
  { term: '官禄宮', plain: '仕事や社会での役割を表す区画', system: '紫微斗数' },
  { term: '財帛宮', plain: 'お金の入り方と使い方を表す区画', system: '紫微斗数' },
  { term: '遷移宮', plain: '外へ出たときの動き方を表す区画', system: '紫微斗数' },
  { term: '福徳宮', plain: '心の満たされ方を表す区画', system: '紫微斗数' },

  // ── 西洋・インド占星術 ─────────────────────────────
  { term: 'アセンダント', plain: '生まれた瞬間に東の地平線にあった位置。外から見える第一印象を表す', system: '西洋占星術' },
  { term: 'ミッドヘブン', plain: '生まれた瞬間に天頂にあった位置。社会での立ち位置を表す', system: '西洋占星術' },
  { term: 'ハウス', plain: '生まれた時刻から出す12の区画。どの場面に力が出るかを表す', system: '西洋占星術' },
  { term: 'コンジャンクション', plain: '二つの天体が同じ位置にあり、働きが重なる状態', system: '西洋占星術' },
  { term: 'オポジション', plain: '二つの天体が正反対にあり、引っ張り合う状態', system: '西洋占星術' },
  { term: 'スクエア', plain: '二つの天体が直角にあり、摩擦が起きやすい状態', system: '西洋占星術' },
  { term: 'トライン', plain: '二つの天体が調和し、力が流れやすい状態', system: '西洋占星術' },
  { term: 'セクスタイル', plain: '二つの天体が緩やかに支え合う状態', system: '西洋占星術' },
  { term: 'ナクシャトラ', plain: '月の位置を27に分けた区画。感じ方の細かい傾向を表す', system: 'インド占星術' },

  // ── 九星・宿曜 ──────────────────────────────────
  { term: '本命星', plain: '生まれた年から出す、その人の基本の傾向', system: '九星気学' },
  { term: '月命星', plain: '生まれた月から出す、内面の傾向', system: '九星気学' },
  { term: '宿曜', plain: '生まれた日の月の位置を27に分けて読む見方', system: '宿曜' },
  { term: '栄親', plain: '互いに育て合いやすい組み合わせ', system: '宿曜' },
  { term: '安壊', plain: '安心と揺さぶりが同時に起きやすい組み合わせ', system: '宿曜' },
  { term: '業胎', plain: '縁が切れにくく、長く関わりやすい組み合わせ', system: '宿曜' },
] as const

/** 本文に出してはいけない語の一覧 */
export const JARGON_TERMS: readonly string[] = TERM_GLOSSARY.map(item => item.term)

const JARGON_PATTERN = new RegExp(JARGON_TERMS.map(escapeRegExp).join('|'))

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function containsJargon(text: string): boolean {
  return JARGON_PATTERN.test(text)
}

export function findJargon(text: string): string[] {
  return JARGON_TERMS.filter(term => text.includes(term))
}

const GLOSS_BY_TERM = new Map(TERM_GLOSSARY.map(item => [item.term, item]))

export function glossFor(term: string): TermGloss | null {
  return GLOSS_BY_TERM.get(term) ?? null
}

/**
 * evidence の detail から、その根拠に含まれる用語の解説を集める。
 * 本文には出さず、命式詳細タブと「根拠を見る」でのみ表示する。
 */
export function glossesForEvidence(detail: string): TermGloss[] {
  return findJargon(detail).flatMap(term => {
    const gloss = glossFor(term)
    return gloss ? [gloss] : []
  })
}
