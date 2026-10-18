// 画面確認用の仮データ。文章はすべてサンプル。
import { images } from './images'
import type { Book, BirthProfile, BookTheme, Chapter, CoupleYear, Partner, Plan, Relation, RelationGroup, SavedReading, YearReading } from './types'

export const mockProfile: BirthProfile = {
  nickname: 'ゆう',
  birthDate: '1994-05-12',
  birthTime: null,
  birthPlace: '東京都',
  gender: 'female',
}

export const mockPersonaTitle = '静かに、深く根を張る人'

export const mockChapters: Chapter[] = [
  { id: 'core', title: 'あなたの芯', sub: '大切にしていること', image: images.nature.leaf },
  { id: 'distance', title: '人との距離', sub: '近づき方と、心地よい間合い', image: images.nature.shell },
  { id: 'strength', title: '力の出し方', sub: '仕事や役割での強み', image: images.nature.mistyMountains },
  { id: 'rest', title: '心の休め方', sub: '疲れやすい場面と戻り方', image: images.nature.ripple },
]

export const mockYears: YearReading[] = [
  { year: 2024, label: '', title: '土台を固め直す', tags: ['見直す', '整える'], summary: '［サンプル］足元を整えるのに向いた年です。', sections: [] },
  { year: 2025, label: '', title: '手放して軽くなる', tags: ['手放す'], summary: '［サンプル］抱えていたものを下ろしやすい年です。', sections: [] },
  {
    year: 2026,
    label: '今年',
    title: '新しい役割を引き受ける年',
    tags: ['任される', '人前に立つ', '手放す'],
    summary: '［サンプル］頼まれごとが増え、これまでより人前に立つ場面が出てきます。全部を一人で抱えず、任せる相手を早めに決めておくと…',
    sections: [
      { heading: 'この年の流れ', body: '［サンプル］頼まれごとが増え、これまでより人前に立つ場面が出てくる年です。準備が整う前に声がかかることもありますが、引き受けながら形にしていく力があなたにはあります。' },
      { heading: '人との関わり', body: '［サンプル］新しい立場に慣れるまで、身近な人との時間が減りやすくなります。忙しさを説明する一言を、先に伝えておくと安心です。' },
      { heading: '気をつけたいこと', body: '［サンプル］全部を一人で抱えると、疲れが表に出にくいまま溜まります。任せる相手を早めに決めておきましょう。' },
    ],
  },
  { year: 2027, label: '来年', title: '広げた枝を選ぶ', tags: ['選ぶ'], summary: '［サンプル］広がったものから、残すものを選ぶ年です。', sections: [] },
  { year: 2028, label: '', title: '実りを確かめる', tags: ['確かめる'], summary: '［サンプル］続けてきたことの手応えを確かめる年です。', sections: [] },
]

export const mockPartners: Partner[] = [
  { id: 'p-misaki', name: 'みさき', relation: 'お付き合い中', birthDate: '1995-11-03', birthTime: null, birthPlace: '神奈川県', gender: 'female', metYear: 2021 },
]

/** iOS PartnerProfilesView と同じ並び・同じ文言 */
export const relationOptions: Relation[] = ['片思い', 'お付き合い中', '婚約中', '夫婦', '復縁希望', '元恋人', '友人', '親友', '会社の同僚', '上司', '部下', '取引先', '親', '子', '兄弟姉妹', '配偶者の家族', 'その他']
export function relationGroup(label: Relation): RelationGroup {
  if (['片思い', 'お付き合い中', '婚約中', '夫婦', '復縁希望', '元恋人'].includes(label)) return 'romantic'
  if (['親', '子', '兄弟姉妹', '配偶者の家族'].includes(label)) return 'family'
  return 'friend'
}

export const mockCoupleYears: CoupleYear[] = [
  { year: 2021, label: '出会った年', title: 'お互いの輪郭を確かめる年', you: '始まりの力', partner: '受けとめる力', body: ['［サンプル］新しいものに目が向きやすい時期に出会ったふたりです。相手の考え方を知ろうとする姿勢が、そのまま関係の土台になります。', '［サンプル］急いで形を決めるより、話す回数を重ねることが合っていました。'] },
  { year: 2022, label: '1年目', title: '暮らしのリズムを合わせる年', you: '整える力', partner: '広げる力', body: ['［サンプル］片方は足場を固めたく、もう片方は外へ広げたくなる組み合わせです。', '［サンプル］予定の立て方の違いを、責めずに言葉にするのが鍵になります。'] },
  { year: 2023, label: '2年目', title: '本音を出し合う年', you: '表現する力', partner: '見守る力', body: ['［サンプル］思っていることが外に出やすい年です。言葉の強さに驚くことがあっても、それは距離が縮んだしるしでもあります。', '［サンプル］返事を急がず、一晩置く習慣が役立ちます。'] },
  { year: 2024, label: '3年目', title: 'それぞれの持ち場が育つ年', you: '育てる力', partner: '挑む力', body: ['［サンプル］仕事や家族など、ふたり以外の役割が増えやすい年です。', '［サンプル］会う時間が減っても、短い連絡を途切れさせないことが支えになります。'] },
  { year: 2025, label: '4年目', title: '大切なものを選び直す年', you: '選ぶ力', partner: '支える力', body: ['［サンプル］手放すものと残すものを考えやすい年です。', '［サンプル］相手の決断を、自分への評価と結びつけないようにすると楽になります。'] },
  { year: 2026, label: '今年', title: '歩幅をそろえ直す一年', you: '新しい役割', partner: '内側を整える', body: ['［サンプル］あなたは外で新しい役割を持ちやすく、みさきさんは内側を整えたくなる年です。向きが違っても、どちらかが間違っているわけではありません。', '［サンプル］話す時間を前もって決めておくと、すれ違いが小さいうちに気づけます。'] },
  { year: 2027, label: '来年', title: '次の約束を考える年', you: '広げる力', partner: '始まりの力', body: ['［サンプル］ふたりとも前へ進む気持ちが強まる年です。', '［サンプル］具体的な計画を一緒に書き出すと、勢いを形にしやすくなります。'] },
]

/** サーバー lib/aiBooks.ts の BOOK_THEMES と同じ。iOSの初期値は「恋愛・関係」 */
export const bookThemes: BookTheme[] = ['恋愛・関係', '仕事', '人間関係', '時期の判断', 'その他']

/** サーバーと同じく、前後の空白を除いた「文字（コードポイント）」で数える。絵文字も1文字 */
export function countChars(text: string) { return [...text.trim()].length }

/**
 * サーバー validateBookQuestion と同じ判定を先に画面で行う（送信してから断られないように）。
 * 最終判断は必ずサーバー側。文言もサーバーと同じ。
 */
export function bookQuestionProblem(question: string): string | null {
  const q = question.normalize('NFKC')
  if (/自殺|自傷|死にたい|消えたい|命を絶|生きていたくない/.test(q))
    return 'この内容は鑑定書では扱えません。今すぐ危険がある場合は119・110へ連絡し、身近な人や医療機関に相談してください。'
  if (/寿命|余命|死ぬ|亡くなる|妊娠|不妊|病気|診断|癌|がん|服薬|薬を|治療|訴訟|裁判|法律判断|投資|株価|銘柄|殺す|傷つける方法|監視|ストーキング/.test(q))
    return '健康・妊娠・生死、法律や投資の判断、他者への加害や監視は扱えません。気持ちの整理や人との接し方について相談してください。'
  return null
}

/** iOS OnboardingView.prefectures / サーバー birthContext.ts と同じ47都道府県（それ以外は時差計算ができない） */
export const prefectures = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']

export const mockBooks: Book[] = [
  {
    id: 'b-generating',
    title: 'みさきとの2026年について',
    theme: '恋愛・関係',
    question: '会う時間が減っています。',
    createdAt: '2026-10-17',
    state: 'generating',
    progress: 60,
    sourceTitle: 'みさきとの2026年',
    sourceSub: '歩幅をそろえ直す一年',
    sourceHref: '/couple/p-misaki?year=2026',
    cover: images.starMountains,
    questionsLeft: 2,
    sections: [],
  },
  {
    id: 'b-distance',
    title: '会えない時間を、どう過ごすか',
    theme: '恋愛・関係',
    question: '今年、彼女が転職して忙しくなりました。会う時間が減って不安になります。どんな距離感で過ごすとよいでしょうか。',
    createdAt: '2026-10-12',
    state: 'delivered',
    sourceTitle: 'みさきとの2026年',
    sourceSub: '歩幅をそろえ直す一年',
    sourceHref: '/couple/p-misaki?year=2026',
    cover: images.moonClouds,
    questionsLeft: 2,
    sections: [
      { heading: '一　ふたりの2026年に起きていること', body: '［サンプル］この年のあなたは外で新しい役割を持ちやすく、みさきさんは自分の内側を整えたくなる流れにあります。忙しさの理由が違うため、同じ「会えない」でも、受けとめ方に差が出やすい時期です。' },
      { heading: '二　不安が大きくなるとき', body: '［サンプル］連絡の間隔が空くと、理由を自分の側に探したくなるかもしれません。けれど、ここで読んでいるのは相手の心そのものではなく、年の流れです。決めつける前に、確かめる言葉を持っておきましょう。' },
      { heading: '三　この年におすすめの過ごし方', body: '［サンプル］会う日を先に一つだけ決めておく。短くても、その日の出来事を一言ずつ送り合う。会えない間に、あなた自身の新しい役割を育てておく。' },
    ],
  },
  {
    id: 'b-transfer',
    title: '異動の話を受けるかどうか',
    theme: '時期の判断',
    question: '異動の話を受けるかどうか迷っています。',
    createdAt: '2026-09-28',
    state: 'delivered',
    sourceTitle: 'あなたの2026年',
    sourceSub: '新しい役割を引き受ける年',
    sourceHref: '/you/years/2026',
    cover: images.leaves,
    questionsLeft: 2,
    sections: [{ heading: '一　この年の流れから', body: '［サンプル］新しい役割を引き受けやすい年です。' }],
  },
  {
    id: 'b-rely',
    title: '人に頼るのが苦手なこと',
    theme: 'その他',
    question: '人に頼るのが苦手です。',
    createdAt: '2026-09-03',
    state: 'delivered',
    sourceTitle: 'あなたの芯',
    sourceSub: '性格の章',
    sourceHref: '/you',
    cover: images.starMountains,
    questionsLeft: 2,
    sections: [{ heading: '一　あなたの芯から', body: '［サンプル］自分で整えてから人に見せたい人です。' }],
  },
]

export const mockFailedBook: Book = {
  id: 'b-failed',
  title: 'みさきとの2026年について',
  theme: '恋愛・関係',
  question: '会う時間が減っています。',
  createdAt: '2026-10-16',
  state: 'failed',
  failureCode: 'BOOK_PROVIDER_TIMEOUT',
  sourceTitle: 'みさきとの2026年',
  sourceSub: '歩幅をそろえ直す一年',
  sourceHref: '/couple/p-misaki?year=2026',
  cover: images.starMountains,
  questionsLeft: 2,
  sections: [],
}

/** 保存できる読みもののキー（本番では reading_conversations のブックマーク） */
export const savedKey = {
  year: (year: number) => `you-${year}`,
  chapter: (id: string) => `chapter-${id}`,
  couple: (partnerId: string, year: number) => `couple-${partnerId}-${year}`,
  couplePrefix: (partnerId: string) => `couple-${partnerId}-`,
}

/** 保存済みキーを、本棚に並べる行に変換する */
export function savedCatalog(partners: Partner[], years: YearReading[] = mockYears, chapters: Chapter[] = mockChapters): SavedReading[] {
  return [
    ...years.map(y => ({ id: savedKey.year(y.year), kind: 'you' as const, label: 'あなた ・ 年ごとの流れ', title: `${y.year}年 ${y.title}`, href: `/you/years/${y.year}` })),
    ...chapters.map(c => ({ id: savedKey.chapter(c.id), kind: 'you' as const, label: 'あなた ・ 性格の章', title: c.title, href: `/you/chapters/${c.id}` })),
    ...partners.flatMap(p => mockCoupleYears.map(y => ({ id: savedKey.couple(p.id, y.year), kind: 'couple' as const, label: `ふたり ・ ${p.name}`, title: `${y.year}年 ${y.title}`, href: `/couple/${p.id}?year=${y.year}` }))),
  ]
}

/** 「一冊つくる」のもとにする読みものの初期値。相手がいればふたりの今年、いなければあなたの今年 */
export function defaultDraftSource(partner: Partner | undefined, year = 2026) {
  const couple = partner && (mockCoupleYears.find(y => y.year === year) ?? mockCoupleYears[mockCoupleYears.length - 1])
  if (partner && couple) {
    return { sourceTitle: `${partner.name}との${couple.year}年`, sourceSub: couple.title, sourceHref: `/couple/${partner.id}?year=${couple.year}`, theme: (relationGroup(partner.relation) === 'romantic' ? '恋愛・関係' : '人間関係') as BookTheme }
  }
  const self = mockYears.find(y => y.year === year) ?? mockYears[0]
  return { sourceTitle: `あなたの${self.year}年`, sourceSub: self.title, sourceHref: `/you/years/${self.year}`, theme: '時期の判断' as BookTheme }
}

export const initialSavedIds = [savedKey.year(2026), savedKey.couple('p-misaki', 2026), savedKey.chapter('distance'), savedKey.couple('p-misaki', 2021)]

export const chapterSections: Record<string, { heading: string; body: string }[]> = {
  core: [{ heading: 'あなたの芯', body: '［サンプル］自分で納得するまで考えてから動く人です。急かされるより、自分のペースで根を張るほど力が出ます。' }],
  distance: [{ heading: '人との距離', body: '［サンプル］近づく前に、相手をよく見て確かめます。打ち解けるまで時間はかかりますが、一度結んだ関係を長く大切にします。' }],
  strength: [{ heading: '力の出し方', body: '［サンプル］任された範囲を丁寧に仕上げる力があります。役割がはっきりしているほど、安心して力を出せます。' }],
  rest: [{ heading: '心の休め方', body: '［サンプル］人といる時間のあとに、一人で整える時間が必要です。予定を詰めすぎないことが、いちばんの休み方になります。' }],
}

export const plans: Plan[] = [
  { id: 'single', name: '1冊', credits: 1, price: 500, detail: '相談のブック1冊（ブックへの質問2回つき）', recommended: false },
  { id: 'pack5', name: '5冊セット', credits: 5, price: 1980, detail: '1冊あたり396円。1冊ずつより約2割お得（どのブックにも質問2回つき）', recommended: true },
]

/** 相談のブック1冊につき、そのブックへ質問できる回数（無料の質問はなし） */
export const QUESTIONS_PER_BOOK = 2
