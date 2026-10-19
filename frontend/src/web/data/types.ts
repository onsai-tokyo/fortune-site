export type Gender = 'female' | 'male'

export interface BirthProfile {
  /** 呼び名（任意。iOSのオンボーディング1/6と同じ） */
  nickname: string
  birthDate: string // YYYY-MM-DD
  birthTime: string | null // HH:mm
  birthPlace: string
  gender: Gender
}

export interface ReadingSection {
  heading: string
  body: string
}

/** 本人の年ごとの読みもの（API: /api/timeline, /api/reading/:id/timing-history） */
export interface YearReading {
  sourceId?: string
  sourceCardId?: string
  year: number
  label: string
  title: string
  tags: string[]
  summary: string
  sections: ReadingSection[]
}

/** 性格の章（API: /api/preview/generate で生成し /api/reading/conversations に保存） */
export interface Chapter {
  sourceId?: string
  sourceCardId?: string
  id: string
  title: string
  sub: string
  image: string
  sections?: ReadingSection[]
}

/** iOS PartnerProfilesView.relationshipOptions と同じ17種類（APIへはこの文字列をそのまま relationshipLabel として送る） */
export type Relation = '片思い' | 'お付き合い中' | '婚約中' | '夫婦' | '復縁希望' | '元恋人' | '友人' | '親友' | '会社の同僚' | '上司' | '部下' | '取引先' | '親' | '子' | '兄弟姉妹' | '配偶者の家族' | 'その他'
/** APIの relationshipType（関係の大分類） */
export type RelationGroup = 'romantic' | 'family' | 'friend'

/** 相手（API: /api/partners） */
export interface Partner {
  id: string
  name: string
  relation: Relation
  birthDate: string
  birthTime: string | null
  birthPlace: string
  gender: Gender
  metYear: number | null
}

/** ふたりの年（API: /api/reading/:id/couple-timeline） */
export interface CoupleYear {
  sourceCardId?: string
  year: number
  label: string
  title: string
  you: string
  partner: string
  body: string[]
}

/** APIの state。queued/generating/review は「作成中」として扱う（iOS AIBook.isPending と同じ） */
export type BookState = 'queued' | 'generating' | 'review' | 'delivered' | 'failed'
/** サーバーの BOOK_THEMES と同じ文字列。これ以外はAPIが422を返す */
export type BookTheme = '恋愛・関係' | '仕事' | '人間関係' | '時期の判断' | 'その他'

/** 相談のブック（API: /api/books） */
export interface Book {
  sourceCardId?: string
  id: string
  title: string
  theme: BookTheme
  question: string
  createdAt: string
  deliveredAt?: string
  state: BookState
  progress?: number
  failureCode?: string
  sourceTitle: string
  sourceSub: string
  sourceHref: string
  sourceId?: string
  document?: { summary?: string; answer?: string; conclusion?: string; highlights?: string[]; sections?: ReadingSection[]; actions?: string[] }
  cover: string
  sections: ReadingSection[]
  /** このブックについて質問できる残り回数（1冊につき2回。サーバー側の追加が必要） */
  questionsLeft: number
}

export interface SavedReading {
  id: string
  kind: 'you' | 'couple'
  label: string
  title: string
  href: string
}

/** 相談のブックの残り冊数（API: /api/books/status） */
export interface CreditStatus {
  remaining: number
  paused: boolean
}

export type PlanId = 'single' | 'pack5'

export interface Plan {
  id: PlanId
  name: string
  credits: number
  price: number
  detail: string
  recommended: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}
