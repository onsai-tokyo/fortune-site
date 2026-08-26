/**
 * 年カードを「一目で何の年か分かる」形にするための資産。
 *
 * 【設計方針】
 * 1. バッジは全員が知っている言葉だけを使う。「婚期」「仕事の転換期」など。
 *    占術用語（正官・六合・干支・傷官・配偶者星・日支）は一切使わない。
 * 2. 同じテーマが人生に複数回来るときは通し番号を付ける。
 *    婚期 → 第二の婚期 → 第三の婚期。これが読み物としての引きになる。
 * 3. 本文は「何が起こりやすいか」を生活・感情・出来事のレベルまで落とす。
 *    抽象語（基準・前提・軸・輪郭）だけで終わる文を作らない。
 * 4. 恋愛の出来事は恋愛の文にしか出さない。仕事の出来事は仕事の文にしか出さない。
 */

export type LifeEventKey =
  | 'marriage' | 'meeting' | 'separation'
  | 'work' | 'money' | 'move'
  | 'study' | 'reset' | 'seed'

export type LifeDomain = 'love' | 'work' | 'life'

export interface LifeEventDefinition {
  key: LifeEventKey
  domain: LifeDomain
  /** 1回目のバッジ名 */
  label: string
  /** 2回目以降に「第二の〜」を付けてよいか。出会い・整理などは番号を付けない */
  ordinal: boolean
  /** バッジの優先度。小さいほど強い。1年に最大2つまで表示する */
  priority: number
  /**
   * その年に起こりやすいこと。生活・感情・出来事のレベルで書く。
   * 各カードで3件を決定論的に選ぶ。断定を避けつつ、具体名詞を必ず含めること。
   */
  outcomes: readonly string[]
  /** 見出しの下に置く一行。バッジだけでは伝わらない補足 */
  lead: string
  /** その年に効く具体的な行動。1件だけ選ぶ */
  actions: readonly string[]
}

const ORDINAL_PREFIX = ['', '第二の', '第三の', '第四の', '第五の'] as const

export const LIFE_EVENTS: readonly LifeEventDefinition[] = [
  {
    key: 'marriage',
    domain: 'love',
    label: '婚期',
    ordinal: true,
    priority: 1,
    lead: '関係を「これから一緒に暮らす形」へ切り替える話が出やすい時期です。',
    outcomes: [
      '結婚、入籍、両家への挨拶など、関係を形にする話が具体的に進みやすい',
      '同棲や引っ越しなど、二人の生活を一つにまとめる相談が出やすい',
      '相手の家族や友人に会う機会が増え、関係が周囲に開かれていきやすい',
      '将来のお金の話、住む場所の話など、現実的な条件をすり合わせる場面が増える',
      '「このままでいいのか」を相手に確かめたくなり、答えを求めやすくなる',
      '結婚しない選択も含めて、関係の続け方をはっきり決める流れになりやすい',
      '指輪、記念日、写真など、形に残るものへお金と時間を使いやすい',
    ],
    actions: [
      '相手に望むことと、自分が守れることを三つずつ書き出して見せ合う',
      '住む場所、働き方、お金の分担を、気持ちとは別に一度だけ話す',
      '返事を保留にしている件があれば、期限だけを先に決める',
    ],
  },
  {
    key: 'meeting',
    domain: 'love',
    label: '出会いの年',
    ordinal: false,
    priority: 2,
    lead: '人と会う量そのものが増え、そこから縁が動きやすい時期です。',
    outcomes: [
      '紹介、再会、職場や趣味の場など、思いがけない経路から人と知り合いやすい',
      '連絡先が増え、誘われる回数が増える一方で、選ぶ基準が問われやすい',
      '以前は好きにならなかったタイプに惹かれ、自分の好みが更新されやすい',
      '過去に縁のあった相手から連絡が来て、気持ちが動きやすい',
      '見た目や服装、髪型を変えたくなり、人からの反応が変わりやすい',
      '相手からの好意に気づきやすくなり、受け身でも関係が始まりやすい',
    ],
    actions: [
      '誘いを断る前に、行くと決めた予定を月に一つだけ増やしてみる',
      '連絡が続かなかった相手を追わず、続いた相手に時間を寄せる',
      '会った人の印象を一行でメモし、三か月後に読み返す',
    ],
  },
  {
    key: 'separation',
    domain: 'love',
    label: '関係を見直す年',
    ordinal: false,
    priority: 2,
    lead: '続けるか離れるかを、感情ではなく条件で決めやすくなる時期です。',
    outcomes: [
      '相手の事情や、これまで見えていなかった情報が表面化しやすい',
      '長く保留にしていた違和感がはっきりして、距離を置きたくなりやすい',
      '連絡の頻度が変わり、会う回数そのものが自然に減っていきやすい',
      '一度離れてから、あらためて関係を選び直す流れになりやすい',
      '周囲の人間関係も同時に整理され、付き合う相手が入れ替わりやすい',
      '別れを選んでも選ばなくても、関係の前提を言葉にし直すことになりやすい',
    ],
    actions: [
      '続ける条件と離れる条件を、それぞれ三つだけ紙に書く',
      '一度の感情で結論を出さず、決める日を先に決めておく',
      '相手を責める前に、自分が我慢していたことを一つ言葉にする',
    ],
  },
  {
    key: 'work',
    domain: 'work',
    label: '仕事の転換期',
    ordinal: true,
    priority: 1,
    lead: '任される範囲が変わり、働き方そのものを選び直しやすい時期です。',
    outcomes: [
      '任される範囲が増え、忙しくなる一方で評価につながりやすい',
      '転職、部署異動、担当替えなど、所属や役割が変わる話が出やすい',
      '後輩や部下がつき、自分でやるより人に任せる仕事が増えやすい',
      '独立、副業、資格取得など、今の会社の外に選択肢を作りたくなりやすい',
      '断れずに引き受けた仕事が積み上がり、優先順位の見直しを迫られやすい',
      '苦手だと思っていた分野の仕事が回ってきて、結果的に幅が広がりやすい',
      '職場の人間関係が入れ替わり、相談できる相手が変わりやすい',
    ],
    actions: [
      '引き受ける仕事、断る仕事、学ぶ仕事を一つずつ決めて口に出す',
      '今の仕事を三年続けた自分を想像し、続けたいかだけを判断する',
      '手放してよい業務を一つ選び、引き継ぎの相談を始める',
    ],
  },
  {
    key: 'money',
    domain: 'life',
    label: 'お金の基準が変わる年',
    ordinal: false,
    priority: 3,
    lead: '入るお金も出るお金も動き、使い方の基準を決め直す時期です。',
    outcomes: [
      '収入が増える一方で、大きな出費も増えやすい',
      '固定費、保険、サブスクなど、毎月出ていくお金を見直したくなりやすい',
      '引っ越し、車、家電など、まとまった買い物の判断を迫られやすい',
      '貯める目的がはっきりして、目標額を決めたくなりやすい',
      '人にお金を使う場面が増え、線引きを考えることになりやすい',
      '働いた分がそのまま収入に反映される形へ、稼ぎ方が変わりやすい',
    ],
    actions: [
      '毎月の固定費を一度だけ全部書き出し、一つ止める',
      '大きな買い物は、決めた日から一週間空けてから判断する',
      '増えた分の使い道を、貯める・使う・備えるで先に分ける',
    ],
  },
  {
    key: 'move',
    domain: 'life',
    label: '引っ越しの年',
    ordinal: false,
    priority: 2,
    lead: '暮らす場所や過ごし方が変わり、日常の土台が入れ替わる時期です。',
    outcomes: [
      '引っ越し、同棲、実家を出るなど、住む場所を変える話が出やすい',
      '通勤や通学の経路が変わり、一日の時間の使い方が変わりやすい',
      '部屋の模様替えや大きな処分をしたくなり、身の回りが軽くなりやすい',
      '職場の移転や転勤など、自分の意思とは別に環境が動きやすい',
      '住む場所を変えたことをきっかけに、付き合う人が入れ替わりやすい',
      '実家や家族との距離感を、あらためて決め直すことになりやすい',
    ],
    actions: [
      '候補地、家賃、移動時間を並べ、日常が続く案を一つ選ぶ',
      '一年使わなかったものを、まず十個だけ手放す',
      '動く時期を決め、そこから逆算して準備の日を押さえる',
    ],
  },
  {
    key: 'study',
    domain: 'work',
    label: '学び直しの年',
    ordinal: false,
    priority: 3,
    lead: '今の実力の外側に手を伸ばすことが、次の役割につながる時期です。',
    outcomes: [
      '資格、研修、学び直しなど、時間をかけて身につける話が出やすい',
      '教えてくれる人や、目標になる人と出会いやすい',
      '興味の方向が変わり、これまで読まなかった分野に手が伸びやすい',
      '人に教える側に回り、自分の理解の穴に気づきやすい',
      '結果がすぐ出ないことに時間を使うため、焦りを感じやすい',
      '学んだことが、その年ではなく翌年以降の仕事につながりやすい',
    ],
    actions: [
      '一日十五分だけ確保し、続いた記録を目に見える形で残す',
      '学ぶ範囲を一つに絞り、他を今年はやらないと決める',
      '学んだことを誰かに一度説明してみる',
    ],
  },
  {
    key: 'reset',
    domain: 'life',
    label: '整理の年',
    ordinal: false,
    priority: 4,
    lead: '増やすより、続けないものを決めることで前に進みやすい時期です。',
    outcomes: [
      '合わない人、面倒な用事、惰性で続けていたことから自然に離れやすい',
      '隠れていたことが表に出て、驚く場面があるかもしれない',
      '体調や生活リズムを立て直すきっかけが来やすい',
      '予定を詰めすぎると疲れが出やすく、休む時間が必要になりやすい',
      '古い持ち物や書類を処分したくなり、身軽になりやすい',
      '無理をしていた関係から距離を取り、気持ちが軽くなりやすい',
    ],
    actions: [
      '今年やらないことを三つ決めて、人に伝える',
      '予定を入れない日を月に一日だけ先に押さえる',
      '返事を止めている連絡に、断りでいいので一度返す',
    ],
  },
  {
    key: 'seed',
    domain: 'life',
    label: '種まきの年',
    ordinal: false,
    priority: 5,
    lead: '大きな出来事より、あとで効いてくる準備が進みやすい時期です。',
    outcomes: [
      '目立った変化は少ない一方で、次につながる縁や話が静かに増えやすい',
      '始めたことがすぐ結果にならず、続けるかどうかを試されやすい',
      '人からの相談が増え、自分の役割が周囲の中で決まっていきやすい',
      '生活のリズムが安定し、新しいことを試す余力が生まれやすい',
      '来年以降の計画を立てたくなり、目標が言葉になりやすい',
    ],
    actions: [
      '来年やりたいことを三つだけ書き、一つを今月始める',
      '続けると決めたことを、週に一度の予定として固定する',
      '会っておきたい人に一人だけ連絡する',
    ],
  },
]

const BY_KEY = new Map(LIFE_EVENTS.map(item => [item.key, item]))

export function lifeEvent(key: LifeEventKey): LifeEventDefinition {
  const found = BY_KEY.get(key)
  if (!found) throw new Error(`未定義のライフイベントキー: ${key}`)
  return found
}

/**
 * バッジ名を作る。同じキーが人生で何度目かによって「第二の婚期」になる。
 * occurrence は 0 始まり。
 */
export function badgeLabel(key: LifeEventKey, occurrence: number): string {
  const definition = lifeEvent(key)
  if (!definition.ordinal || occurrence === 0) return definition.label
  const prefix = ORDINAL_PREFIX[Math.min(occurrence, ORDINAL_PREFIX.length - 1)]
  return `${prefix}${definition.label}`
}

/** 決定論的に n 件選ぶ。同じ入力なら常に同じ結果になる。 */
export function pickDeterministic<T>(items: readonly T[], seed: string, count: number, used: Set<string> = new Set()): T[] {
  let hash = 0
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  const ordered = items.map((item, index) => ({ item, index }))
    .sort((left, right) => ((hash + left.index * 7) % items.length) - ((hash + right.index * 7) % items.length))
  const result: T[] = []
  for (const entry of ordered) {
    const identity = String(entry.item)
    if (used.has(identity)) continue
    used.add(identity)
    result.push(entry.item)
    if (result.length >= count) break
  }
  // 使用済みで足りない場合だけ重複を許す
  for (const entry of ordered) {
    if (result.length >= count) break
    if (!result.includes(entry.item)) result.push(entry.item)
  }
  return result
}
