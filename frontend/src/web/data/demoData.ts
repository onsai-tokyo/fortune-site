import { images } from './images'
import { savedKey } from './readingData'
import type { Book, BirthProfile, Chapter, CoupleYear, Partner, YearReading } from './types'
export const demoDeliverySections = [{ heading: '一　この年の流れから', body: '［サンプル］選んだ読みものをもとにした答えがここに入ります。' }]
export const demoAnswer = '［サンプル］ブックの内容と、もとにした読みものに沿って短くお答えします。'

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

export const mockCoupleYears: CoupleYear[] = [
  { year: 2021, label: '出会った年', title: 'お互いの輪郭を確かめる年', you: '始まりの力', partner: '受けとめる力', body: ['［サンプル］新しいものに目が向きやすい時期に出会ったふたりです。相手の考え方を知ろうとする姿勢が、そのまま関係の土台になります。', '［サンプル］急いで形を決めるより、話す回数を重ねることが合っていました。'] },
  { year: 2022, label: '1年目', title: '暮らしのリズムを合わせる年', you: '整える力', partner: '広げる力', body: ['［サンプル］片方は足場を固めたく、もう片方は外へ広げたくなる組み合わせです。', '［サンプル］予定の立て方の違いを、責めずに言葉にするのが鍵になります。'] },
  { year: 2023, label: '2年目', title: '本音を出し合う年', you: '表現する力', partner: '見守る力', body: ['［サンプル］思っていることが外に出やすい年です。言葉の強さに驚くことがあっても、それは距離が縮んだしるしでもあります。', '［サンプル］返事を急がず、一晩置く習慣が役立ちます。'] },
  { year: 2024, label: '3年目', title: 'それぞれの持ち場が育つ年', you: '育てる力', partner: '挑む力', body: ['［サンプル］仕事や家族など、ふたり以外の役割が増えやすい年です。', '［サンプル］会う時間が減っても、短い連絡を途切れさせないことが支えになります。'] },
  { year: 2025, label: '4年目', title: '大切なものを選び直す年', you: '選ぶ力', partner: '支える力', body: ['［サンプル］手放すものと残すものを考えやすい年です。', '［サンプル］相手の決断を、自分への評価と結びつけないようにすると楽になります。'] },
  { year: 2026, label: '今年', title: '歩幅をそろえ直す一年', you: '新しい役割', partner: '内側を整える', body: ['［サンプル］あなたは外で新しい役割を持ちやすく、みさきさんは内側を整えたくなる年です。向きが違っても、どちらかが間違っているわけではありません。', '［サンプル］話す時間を前もって決めておくと、すれ違いが小さいうちに気づけます。'] },
  { year: 2027, label: '来年', title: '次の約束を考える年', you: '広げる力', partner: '始まりの力', body: ['［サンプル］ふたりとも前へ進む気持ちが強まる年です。', '［サンプル］具体的な計画を一緒に書き出すと、勢いを形にしやすくなります。'] },
]

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

export const initialSavedIds = [savedKey.year(2026), savedKey.couple('p-misaki', 2026), savedKey.chapter('distance'), savedKey.couple('p-misaki', 2021)]

export const chapterSections: Record<string, { heading: string; body: string }[]> = {
  core: [{ heading: 'あなたの芯', body: '［サンプル］自分で納得するまで考えてから動く人です。急かされるより、自分のペースで根を張るほど力が出ます。' }],
  distance: [{ heading: '人との距離', body: '［サンプル］近づく前に、相手をよく見て確かめます。打ち解けるまで時間はかかりますが、一度結んだ関係を長く大切にします。' }],
  strength: [{ heading: '力の出し方', body: '［サンプル］任された範囲を丁寧に仕上げる力があります。役割がはっきりしているほど、安心して力を出せます。' }],
  rest: [{ heading: '心の休め方', body: '［サンプル］人といる時間のあとに、一人で整える時間が必要です。予定を詰めすぎないことが、いちばんの休み方になります。' }],
}
