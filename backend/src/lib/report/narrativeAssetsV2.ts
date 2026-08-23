import type { FactAxis } from './facts.js'
import type { FindingPattern, NarrativeBlock, NarrativeDomain, PageRole } from './narrativeV2.js'

interface AxisLanguage {
  trait: string
  assertion: string
  strength: string
  shadow: string
}

const AXIS_LANGUAGE: Record<FactAxis, AxisLanguage> = {
  drive: { trait: '自分で進む方向を決める力', assertion: '納得できる順序が見えると、迷いの中でも一歩を選べます', strength: '誰も答えを持たない場面で道筋を作れます', shadow: '急いで結論を出すと、まだ必要な条件まで切り捨てやすくなります' },
  cognition: { trait: '出来事の奥にある筋道を読む力', assertion: '情報を一度自分の中で組み直すことで、本当の意味をつかみます', strength: '散らばった情報をひとつの理解へまとめられます', shadow: '考える材料が増えすぎると、動き出す時機を逃しやすくなります' },
  expression: { trait: '内側の思いを伝わる形にする力', assertion: '言葉や形にしたとき、あなたの考えは周囲を動かし始めます', strength: 'まだ言葉になっていない感覚を人へ渡せます', shadow: '正確に伝えようとするほど、最初の一言が遅くなることがあります' },
  relation: { trait: '人との間にちょうどよい距離を作る力', assertion: '相手をよく見てから近づくため、信頼をゆっくり深く育てます', strength: '違う考えの人とも共通の足場を見つけられます', shadow: '相手を優先しすぎると、自分の希望が見えにくくなります' },
  shadow: { trait: '大切な場面ほど反応が深くなる性質', assertion: '心が強く動く場所には、あなたが守りたいものが隠れています', strength: '違和感を早く察し、大事なものを守れます', shadow: '反応の理由が見えない日は、自分や相手を厳しく判断しやすくなります' },
  deficit: { trait: '環境から力を借りることで整う性質', assertion: '足りないものを責めるより、補える場所を選ぶと本来の力が戻ります', strength: '必要な条件を見つけ、現実的に整えられます', shadow: '一人ですべてを補おうとすると、消耗に気づくのが遅れます' },
  tension: { trait: '二つの気持ちを同時に抱えられる性質', assertion: '矛盾を急いで消さずに見つめると、どちらも生かせる答えが見えます', strength: '一方向だけでは見えない選択肢を見つけられます', shadow: '早く白黒をつけようとすると、本音の片方を置き去りにします' },
  'domain-love': { trait: '安心を確かめながら心を開く性質', assertion: '気持ちの強さだけでなく、言葉と行動が続くかを見て関係を選びます', strength: '小さな変化を受け取り、関係を丁寧に育てられます', shadow: '確かめる時間が長いほど、関心がないように誤解されることがあります' },
  'domain-work': { trait: '役割と目的が見えるほど力を出せる性質', assertion: '何のためにどこまで担うかが明確になると、集中が長く続きます', strength: '複雑な仕事を自分の手順へ落とし込めます', shadow: '曖昧な責任まで抱えると、力の配分が崩れやすくなります' },
  timing: { trait: '節目ごとに選択の意味を更新する力', assertion: '同じ出来事でも、時期が変わると次の役割が見えてきます', strength: '変化を経験として次の選択へつなげられます', shadow: '過去の正解に留まると、いま必要な変化を見落としやすくなります' },
}

export const FINDING_PATTERNS_V2: FindingPattern[] = Object.entries(AXIS_LANGUAGE).map(([axis, item]) => ({
  key: `axis:${axis}`,
  axis: axis as FactAxis,
  trait: item.trait,
  coreAssertion: item.assertion,
  strengthFraming: item.strength,
  shadowFraming: item.shadow,
  semanticTags: [axis, ...item.trait.split(/[、。]/).filter(Boolean)],
}))

export function languageForAxis(axis: FactAxis): AxisLanguage {
  return AXIS_LANGUAGE[axis]
}

const ROLE_TEXT: Record<PageRole, [string, string]> = {
  opening: ['{{assertion}}。これは、日々の選び方に繰り返し現れるあなたの輪郭です。', '{{trait}}は、目立つ瞬間より、何度も同じ選択へ戻るときに見えてきます。'],
  core: ['選択肢が並ぶとき、最後にあなたを動かすのは{{trait}}です。', '{{trait}}は、周囲に合わせたあとにも残る、あなた自身の基準です。'],
  cause: ['この傾向は偶然ではありません。複数の見方が重なり、{{assertion}}。', 'あなたの中では、感じることと考えることが結びつき、{{trait}}として表れます。'],
  scene: ['日常では、答えを急ぐより条件を一つずつ確かめる場面に、この性質が現れます。', '人が見過ごす小さな違いに気づいたとき、{{trait}}が静かに働き始めます。'],
  inner: ['外からは落ち着いて見えても、内側では何を守りたいのかを細かく確かめています。', '胸の内側にあるのは、うまく見せることより、自分の選択に納得したいという願いです。'],
  strength: ['{{strength}}。それが、この性質を無理なく使えているときの姿です。', '{{trait}}が強みになると、周囲が迷う場面でも次の一歩を具体的にできます。'],
  shadow: ['一方で、{{shadow}}。強みと弱さは、同じ性質の使い方の違いです。', '{{trait}}を守ろうとしすぎる日は、慣れた方法だけが安全に見えることがあります。'],
  conflict: ['進みたい気持ちと慎重さが同時にある日は、どちらかを否定せず、役割を分けると判断が軽くなります。', '矛盾して見える二つの反応は、場面ごとにあなたを守ってきた別々の知恵です。'],
  exception: ['いつも同じ表れ方をするわけではありません。安心できる場所では、この性質はもっと柔らかく現れます。', '当てはまらない日は性質が消えたのではなく、疲れや環境によって使い方が変わっています。'],
  relation: ['人との間では、{{trait}}が距離や約束の扱いに現れます。', '信頼できる相手には深く関わり、境界を急に越えられると一歩引いて確かめます。'],
  love: ['心が動いても、安心が続くかを確かめてから、あなたは少しずつ本音を見せます。', '関係が深まるほど、言葉だけでなく日々の小さな一貫性を大切にします。'],
  work: ['役割と目的が見えたとき、{{trait}}は判断と段取りの力に変わります。', '自分の手順を持てる環境ほど、集中を長く保ち、複雑な仕事を整えられます。'],
  change: ['以前は周囲に合わせたあとで違和感に気づいても、いまは小さな段階で条件を確かめ直せます。', '経験を重ねるほど、この性質は自分を守るだけでなく、新しい選択を作る力へ変わります。'],
  question: ['最近、理由を説明できないまま気になっていることはありますか。そこに次の手がかりがあります。', 'いま迷っていることの中で、本当は何を守りたいのでしょう。答えより先に条件を見てください。'],
  action: ['次に迷ったら、守る条件、試す条件、手放す条件を一つずつ書いてみてください。', '一度に全部を変えず、今日確かめられる条件を一つだけ選ぶと、この性質を軽く使えます。'],
  closing: ['変えるべきなのは、あなたの核ではありません。使う場所と結び方を選び直すことです。', '{{trait}}は答えを固定する言葉ではなく、これから自分を理解するための静かな手がかりです。'],
  supplement: ['この章では、命式から確かに読める範囲だけをたどります。断定を広げず、日常で確かめられる手がかりを残します。', '読み取れる情報が少ない領域でも、いま確かな条件から自分の傾向を見つめられます。'],
}

const AXES = Object.keys(AXIS_LANGUAGE) as FactAxis[]
const DOMAINS: NarrativeDomain[] = ['self', 'love', 'work']
const VARIATION_TAILS = [
  '',
  'その違いは、答えよりも選ぶ順番に現れます。',
  '小さな場面を振り返るほど、この輪郭は確かになります。',
  '状況が変わっても、ここに戻ると自分の基準を思い出せます。',
  '人に見える姿と胸の内側を分けて考えると、扱いやすくなります。',
  '急がず一つずつ確かめることで、この力は自然に整います。',
] as const

export const NARRATIVE_BLOCKS_V2: NarrativeBlock[] = AXES.flatMap(axis => DOMAINS.flatMap(domain =>
  (Object.entries(ROLE_TEXT) as [PageRole, [string, string]][]).filter(([role]) => !(domain === 'love' && role === 'work') && !(domain === 'work' && role === 'love')).flatMap(([role, texts]) => texts.flatMap((text, index) => VARIATION_TAILS.map((tail, tailIndex) => ({
    id: `${domain}:${axis}:${role}:${index + 1}:${tailIndex + 1}`,
    patternKey: null,
    axis,
    role,
    domain,
    text: tail ? `${text}${tail}` : text,
    semanticFingerprint: [`${axis}:${role}`, text.slice(0, 18), `variation:${tailIndex + 1}`],
    priority: 1,
  })))),
))
