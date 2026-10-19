import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { bookQuestionProblem, countChars, defaultDraftSource, initialSavedIds, mockBooks, mockFailedBook, mockPartners, mockProfile, mockChapters, mockYears, mockCoupleYears, mockPersonaTitle, plans, QUESTIONS_PER_BOOK, savedKey, relationGroup } from '../data/mock'
import { personalReadings, coupleReadings, type LoadState } from '../data/readingData'
import { demoDeliverySections } from '../data/demoData'
import { images } from '../data/images'
import type { BirthProfile, Book, BookTheme, Chapter, Partner, PlanId, ReadingSection, YearReading, CoupleYear } from '../data/types'
import { supabase } from '../../lib/supabase'
import { apiFetch, newOperationId, webApiPath } from '../data/api'
import { requestCaptchaToken } from '../../lib/turnstile'
import { canCreateWithCredits } from '../data/paymentPolicy'
import { simulatePurchase, paymentsAvailable } from '../data/paymentConfig'
import { webAiAdult, WEB_AI_ADULT_NOTICE } from '../../lib/webAiEligibility'
import { pendingPartnerKey, partnerDraftFromRaw, pendingPartnerFromRaw, pendingPartnerNotice, type PartnerDraft, type PendingPartner } from './partnerDraft'
import { createAccountDeletion } from './accountDeletion'
import { isBookPending, pollBookOperation } from './bookPolling'
import { resolveBookSource } from '../data/bookSource'

const REMOTE = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

/**
 * 画面確認用の状態（仮のバックエンド）。
 * 本番では data/api.ts の各エンドポイントに置き換える。
 *
 * アカウントの考え方（ログイン画面なし）
 * - none      : まだ何も入力していない。出生情報を保存した瞬間に匿名アカウントを作る
 *               本番：supabase.auth.signInAnonymously({ options: { captchaToken } })
 * - anonymous : この端末だけで使っている状態。購入・ブック・相手はアカウントIDにひも付いてサーバーに保存
 * - linked    : メールをひも付け済み。別の端末でも、メールに届くコードで同じ本棚を開ける
 *               本番：supabase.auth.updateUser({ email }) → verifyOtp({ email, token, type: 'email_change' })
 */
export type Session = 'none' | 'anonymous' | 'linked'

interface AppState {
  bookSourcePartners?: Record<string, string>
  bookRefreshError?: string | null
  readingsStatus: LoadState
  personaTitle: string
  selfSourceId?: string
  coupleYears: Record<string, CoupleYear[]>
  coupleStatus: Record<string, LoadState>
  session: Session
  /** 引き継ぎ用にひも付けたメール（linked のときだけ） */
  email: string | null
  /** 決済時に入力した領収書の送り先。未ひも付けなら、引き継ぎの設定に使う */
  receiptEmail: string | null
  profile: BirthProfile | null
  partners: Partner[]
  partnerNotice: string | null
  partnerDraft: PartnerDraft | null
  credits: number
  books: Book[]
  savedIds: string[]
  years: YearReading[]
  chapters: Chapter[]
  /** AIへの情報送信への同意（iOS AISharingConsent と同じく、一度同意すれば以後の相談・質問に適用。本番はサーバーに版つきで保存） */
  aiConsented: boolean
  draft: { sourceTitle: string; sourceSub: string; sourceHref: string; sourceId?: string; sourceCardId?: string; theme: BookTheme; question: string }
  /** 一度でも買ったことがあるか（ないうちはヘッダーに残り冊数を出さない） */
  purchasedEver: boolean
  /** はじめて読みものができた直後の案内を出すか */
  showGuide: boolean
  /** 「書いてから払う」：支払いが反映されたら、書いた相談でそのままブックをつくる */
  pendingCreate: boolean
}

interface Actions {
  reloadReadings: () => void
  saveMeetingYear: (partnerId: string, year: number) => Promise<void>
  /** 引き継ぎ用メールをひも付ける（コード確認後） */
  linkEmail: (email: string) => void
  /** 別の端末で使っていた本棚を、メールのコードで開く */
  restore: (email: string) => void
  /** この端末での利用をやめる（linked のときだけ。メールで戻れる） */
  forgetDevice: () => void
  saveProfile: (profile: BirthProfile) => Promise<void>
  /** 相手は1人だけ。登録すると前の相手と入れ替わる（何度でも無料） */
  setPartner: (partner: Omit<Partner, 'id'>) => Promise<Partner>
  setDraft: (draft: Partial<AppState['draft']>) => void
  createBook: () => Book
  retryBook: (bookId: string) => void
  purchase: (planId: PlanId, receiptEmail: string) => boolean
  toggleSaved: (id: string) => void
  consumeBookQuestion: (bookId: string) => void
  acceptAiConsent: () => void
  dismissGuide: () => void
  /** 残りが0冊のときに「500円で一冊つくる」を押した */
  requestCreateAfterPurchase: () => void
  cancelPendingCreate: () => void
  /** 支払い反映後に呼ぶ。待っている相談があればブックをつくって返す */
  startPendingBook: () => Book | null
  deleteAccount: () => Promise<void>
  applyDemo: (preset: DemoPreset) => void
}

export type DemoPreset = 'default' | 'first-visit' | 'linked' | 'no-partner' | 'zero-credits' | 'book-failed'

const DRAFT_KEY = 'fatelab:web:compose-draft:v1'
const pendingBookKey = (userId: string) => `fatelab:web:pending-book:${userId}:v1`

function mapRemoteBook(b: Record<string, unknown>): Book {
  return {
    id: String(b.id), title: String(b.title ?? '相談のブック'), theme: String(b.theme ?? 'その他') as BookTheme,
    question: String(b.question ?? ''), createdAt: String(b.createdAt ?? b.created_at ?? ''), state: String(b.state ?? 'queued') as Book['state'],
    sourceTitle: String(b.targetTitle ?? ''), sourceSub: '', sourceHref: '', cover: images.starMountains,
    deliveredAt: typeof b.deliveredAt === 'string' ? b.deliveredAt : undefined,
    sourceId: typeof b.sourceId === 'string' ? b.sourceId : undefined,
    sourceCardId: typeof b.focusCardId === 'string' ? b.focusCardId : undefined,
    document: b.document && typeof b.document === 'object' ? b.document as Book['document'] : undefined,
    sections: Array.isArray((b.document as Record<string, unknown> | null)?.sections) ? ((b.document as Record<string, unknown>).sections as ReadingSection[]) : [],
    questionsLeft: Number(b.questionsLeft ?? 2),
    failureCode: typeof b.failureCode === 'string' && /^BOOK_[A-Z_]{1,60}$/.test(b.failureCode) ? b.failureCode : undefined,
  }
}

function initialState(): AppState {
  if (REMOTE) return createBlankState()
  return {
    readingsStatus: 'ready', personaTitle: mockPersonaTitle, coupleYears: Object.fromEntries(mockPartners.map(p => [p.id, mockCoupleYears])), coupleStatus: Object.fromEntries(mockPartners.map(p => [p.id, 'ready'])),
    session: 'anonymous',
    email: null,
    receiptEmail: 'name@example.com',
    profile: mockProfile,
    partners: mockPartners,
    partnerNotice: null, partnerDraft: null,
    credits: 2,
    books: mockBooks,
    savedIds: initialSavedIds,
    years: mockYears,
    chapters: mockChapters,
    aiConsented: false,
    draft: { ...defaultDraftSource(mockPartners[0]), question: '' },
    purchasedEver: true,
    showGuide: false,
    pendingCreate: false,
  }
}

/** 何も入力していない状態（はじめての訪問・この端末での利用をやめた後・退会後） */
function createBlankState(): AppState {
  return { readingsStatus: REMOTE ? 'loading' : 'ready', personaTitle: '', coupleYears: {}, coupleStatus: {}, session: 'none', email: null, receiptEmail: null, profile: null, partners: [], partnerNotice: null, partnerDraft: null, books: [], savedIds: [], years: [], chapters: [], credits: 0, aiConsented: false, draft: { ...(REMOTE ? { sourceTitle: '', sourceSub: '', sourceHref: '', theme: '時期の判断' as BookTheme } : defaultDraftSource(undefined)), question: '' }, purchasedEver: false, showGuide: false, pendingCreate: false }
}

function blankState(): AppState {
  return createBlankState()
}

function loadDraftQuestion(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeDraftQuestion(question: string) {
  try {
    if (question) window.localStorage.setItem(DRAFT_KEY, question)
    else window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    // 保存できない環境（プライベートブラウズ等）では下書きを残さない
  }
}

function storeDraftQuestionForUser(question: string, userId?: string) {
  if (!REMOTE) storeDraftQuestion(question)
  if (!userId) return
  try {
    const key = `${DRAFT_KEY}:${userId}`
    if (question) window.localStorage.setItem(key, question)
    else window.localStorage.removeItem(key)
  } catch {
    // localStorage is optional; the server remains the source of truth after submit.
  }
}

function loadDraftQuestionForUser(userId: string): string {
  try { return window.localStorage.getItem(`${DRAFT_KEY}:${userId}`) ?? (!REMOTE ? window.localStorage.getItem(DRAFT_KEY) : null) ?? '' } catch { return '' }
}

const Ctx = createContext<(AppState & Actions) | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const s = initialState()
    s.draft.question = REMOTE ? '' : loadDraftQuestion()
    return s
  })
  const timers = useRef<number[]>([])
  const stateRef = useRef(state)
  const remoteAuth = useRef({ owner: null as string | null, token: null as string | null, revision: 0 })
  const profileSaveInProgress = useRef(false)
  const profileSaveOwner = useRef<string | null>(null)
  const refreshSequence = useRef(0)
  const partnerSaveInProgress = useRef(false)
  const activeBookPolls = useRef(new Map<string, Promise<string | null>>())
  const activeShelfReads = useRef(new Map<string, Promise<boolean>>())
  const [bookPollRevision, setBookPollRevision] = useState(0)
  stateRef.current = state

  const clearTimers = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = [] }
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), [])

  const refreshRemote = useCallback(async (accessToken: string) => {
    // A stale caller must not invalidate the new owner's active refresh.
    if (remoteAuth.current.token !== accessToken) return false
    const revision = remoteAuth.current.revision
    const sequence = ++refreshSequence.current
    const current = () => refreshSequence.current === sequence && remoteAuth.current.revision === revision && remoteAuth.current.token === accessToken
    if (!current()) return false
    setState(s => ({ ...s, readingsStatus: 'loading', coupleStatus: Object.fromEntries(s.partners.map(p => [p.id, 'loading'])) }))
    try {
      const [history, status, partners, bookshelf, saved] = await Promise.all([
        apiFetch<{ conversations: Array<Record<string, unknown>> }>('/api/reading/conversations', { accessToken }),
        apiFetch<{ remaining: number; purchasedRemaining?: number }>('/api/books/status', { accessToken }),
        apiFetch<{ partners: Array<Record<string, unknown>> }>('/api/partners', { accessToken }),
        apiFetch<{ books: Array<Record<string, unknown>> }>('/api/books', { accessToken }),
        apiFetch<{ saves: Array<{ save_key: string }> }>('/api/reading/saves', { accessToken }),
      ])
      const first = history.conversations?.find(c => c.kind === 'self' || c.kind === 'personal' || c.kind == null)
      const [timing, cards] = first?.id ? await Promise.all([
        apiFetch<{ cards: Array<Record<string, unknown>> }>('/api/reading/' + first.id + '/timing-history', { accessToken }),
        apiFetch<{ cards: Array<Record<string, unknown>> }>('/api/reading/' + first.id + '/cards', { accessToken }),
      ]) : [{ cards: [] }, { cards: [] }]
      const birth = first?.birth_data as Record<string, unknown> | undefined
      const profile = birth ? {
        nickname: String(birth.nickname ?? ''), birthDate: String(birth.birthDate ?? birth.birth_date ?? ''),
        birthTime: typeof birth.birthTime === 'string' ? birth.birthTime : null,
        birthPlace: String(birth.birthplace ?? birth.birthPlace ?? ''),
        gender: birth.gender === 'male' ? 'male' as const : 'female' as const,
      } : null
      const books = (bookshelf.books ?? []).map(mapRemoteBook)
      const sourceId = typeof first?.id === 'string' ? first.id : undefined
      const remoteSavedIds = (saved.saves ?? []).map(item => item.save_key)
      const { years, chapters, personaTitle } = personalReadings(timing.cards ?? [], cards.cards ?? [], sourceId ?? '', images.nature.pampas)
      const coupleResults = await Promise.all((partners.partners ?? []).map(async p => {
        const id = String(p.id)
        try {
          if (!sourceId) throw new Error('SOURCE_MISSING')
          const raw = await apiFetch<Parameters<typeof coupleReadings>[0] & { status: string; meetingYear?: number }>(`/api/reading/${sourceId}/partners/${id}/couple-timeline`, { accessToken })
          if (raw.status === 'needs_meeting_year') return { id, years: [], status: 'needs_meeting_year' as const, meetingYear: undefined }
          if (!['ready', 'partial'].includes(raw.status)) throw new Error('TIMELINE_UNAVAILABLE')
          return { id, years: coupleReadings(raw), status: 'ready' as const, meetingYear: raw.meetingYear }
        } catch { return { id, years: [], status: 'error' as const, meetingYear: undefined } }
      }))
      if (!current()) return false
      setState(s => !current() ? s : ({ ...s, profile: profile?.birthDate ? profile : s.profile,
        session: s.session === 'none' ? 'anonymous' : s.session,
        credits: status.remaining ?? 0, purchasedEver: (status.purchasedRemaining ?? 0) > 0 || s.purchasedEver,
        savedIds: remoteSavedIds,
        books, bookRefreshError: null,
        bookSourcePartners: Object.fromEntries((history.conversations ?? []).filter(c => c.kind === 'compatibility' && typeof c.id === 'string' && typeof c.partner_profile_id === 'string').map(c => [String(c.id), String(c.partner_profile_id)])),
        selfSourceId: sourceId, personaTitle, readingsStatus: 'ready',
        coupleYears: Object.fromEntries(coupleResults.map(p => [p.id, p.years])), coupleStatus: Object.fromEntries(coupleResults.map(p => [p.id, p.status])),
        partners: (partners.partners ?? []).map(p => ({ id: String(p.id), name: String(p.display_name ?? p.name ?? p.displayName ?? '相手'), relation: String(p.relationship_label ?? p.relationshipLabel ?? p.relation ?? 'その他') as Partner['relation'], birthDate: String(p.birthDate ?? p.birth_date ?? ''), birthTime: typeof p.birth_time === 'string' ? p.birth_time : typeof p.birthTime === 'string' ? p.birthTime : null, birthPlace: String(p.birthPlace ?? p.birthplace ?? ''), gender: p.gender === 'male' ? 'male' : 'female', metYear: coupleResults.find(c => c.id === String(p.id))?.meetingYear ?? null })),
        years, chapters,
      }))
      return true
    } catch {
      if (current()) setState(s => ({ ...s, readingsStatus: 'error', personaTitle: '', years: [], chapters: [], coupleYears: {}, coupleStatus: Object.fromEntries(s.partners.map(p => [p.id, 'error'])) }))
      return false
    }
  }, [])

  useEffect(() => {
    if (!REMOTE) return
    let disposed = false
    let authEvents = 0
    const applySession = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (disposed) return
      const owner = session?.user.id ?? null
      const token = session?.access_token ?? null
      // Bind only this form's first anonymous sign-in. A later account switch
      // must load the new owner's data rather than being suppressed by it.
      if (profileSaveInProgress.current && profileSaveOwner.current === null && session?.user.is_anonymous) profileSaveOwner.current = owner
      const changed = remoteAuth.current.owner !== owner
      if (changed || remoteAuth.current.token !== token) remoteAuth.current.revision++
      remoteAuth.current.owner = owner; remoteAuth.current.token = token
      if (changed || !session) clearTimers()
      if (!session) { setState({ ...blankState(), readingsStatus: 'idle' }); return }
      setState(previous => {
        const base = changed ? blankState() : previous
        let partnerDraft = base.partnerDraft
        let partnerNotice = base.partnerNotice
        if (changed) {
          try {
            const raw = window.localStorage.getItem(pendingPartnerKey(session.user.id))
            partnerDraft = partnerDraftFromRaw(raw); partnerNotice = pendingPartnerNotice(raw)
          } catch { /* Never reuse another owner's draft. */ }
        }
        return { ...base, partnerDraft, partnerNotice, session: session.user.email && !session.user.is_anonymous ? 'linked' : 'anonymous', email: session.user.email ?? null,
          draft: { ...base.draft, question: changed ? loadDraftQuestionForUser(session.user.id) : base.draft.question } }
      })
      // A fresh SIGNED_IN must still clear the previous owner's state, but an
      // empty-history refresh must not race the initial profile persistence.
      // The form keeps its input locally and awaits saveProfile before leaving.
      if (!profileSaveInProgress.current || profileSaveOwner.current !== owner) void refreshRemote(session.access_token)
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (!disposed && authEvents === 0) applySession(data.session)
    }).catch(() => { if (!disposed && authEvents === 0) applySession(null) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      authEvents++
      applySession(session)
    })
    return () => { disposed = true; remoteAuth.current.revision++; listener.subscription.unsubscribe() }
  }, [refreshRemote])

  const deliverLater = useCallback((bookId: string) => {
    // 実際はワーカーが生成し、/api/books/operations/:id のポーリングで完了を知る
    const t = window.setTimeout(() => {
      setState(s => ({
        ...s,
        books: s.books.map(b => b.id === bookId ? { ...b, state: 'delivered', progress: 100, sections: demoDeliverySections } : b),
      }))
    }, 6000)
    timers.current.push(t)
  }, [])

  // 仮データの「作成中」のブックも、時間が経つと届くようにする
  useEffect(() => {
    if (REMOTE) return
    stateRef.current.books.filter(b => b.state === 'queued' || b.state === 'generating' || b.state === 'review').forEach(b => deliverLater(b.id))
  }, [deliverLater])

  const createBookNow = useCallback((): Book => {
    const draft = stateRef.current.draft
    const created: Book = {
      id: `b-${Date.now()}`,
      title: `${draft.sourceTitle}について`,
      theme: draft.theme,
      question: draft.question.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      state: 'generating',
      progress: 10,
      sourceTitle: draft.sourceTitle,
      sourceSub: draft.sourceSub,
      sourceHref: draft.sourceHref,
      sourceId: draft.sourceId,
      sourceCardId: draft.sourceCardId,
      cover: images.starMountains,
      sections: [],
      questionsLeft: QUESTIONS_PER_BOOK,
    }
    storeDraftQuestion('')
    setState(s => ({ ...s, credits: s.credits - 1, books: [created, ...s.books], draft: { ...s.draft, question: '' } }))
    if (!REMOTE) deliverLater(created.id)
    return created
  }, [deliverLater])

  const remoteToken = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null, [])

  const deleteAccount = useMemo(() => createAccountDeletion({
    remote: REMOTE,
    currentOwner: () => remoteAuth.current.owner,
    session: async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return data.session ? { owner: data.session.user.id, token: data.session.access_token } : null
    },
    remove: async accessToken => { await apiFetch('/api/reading/account', { method: 'DELETE', accessToken }) },
    signOut: async () => {
      // Only remove this browser's session after server-confirmed deletion.
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
    },
    clearLocal: owner => {
      storeDraftQuestionForUser('', owner)
      if (owner) {
        try {
          window.localStorage.removeItem(pendingPartnerKey(owner))
          window.localStorage.removeItem(pendingBookKey(owner))
        } catch { /* Server deletion has succeeded; storage may be unavailable. */ }
      }
      refreshSequence.current++
      clearTimers()
      setState(blankState())
    },
  }), [])
  // Shelf polling does not put all reading pages back into their loading state.
  const refreshBookShelf = useCallback((owner: string): Promise<boolean> => {
    const existing = activeShelfReads.current.get(owner)
    if (existing) return existing
    const pending = (async () => {
    const token = remoteAuth.current.token
    if (!token || remoteAuth.current.owner !== owner) return false
    const [bookshelf, status] = await Promise.all([
      apiFetch<{ books: Array<Record<string, unknown>> }>('/api/books', { accessToken: token }),
      apiFetch<{ remaining: number; purchasedRemaining?: number }>('/api/books/status', { accessToken: token }),
    ])
    if (remoteAuth.current.owner !== owner) return false
    setState(s => ({ ...s, books: (bookshelf.books ?? []).map(mapRemoteBook), credits: status.remaining,
      purchasedEver: (status.purchasedRemaining ?? 0) > 0 || s.purchasedEver, bookRefreshError: null }))
    return true
    })().finally(() => { activeShelfReads.current.delete(owner) })
    activeShelfReads.current.set(owner, pending)
    return pending
  }, [])
  const pollRemoteBook = useCallback((operationId: string, _accessToken: string): Promise<string | null> => {
    const owner = remoteAuth.current.owner
    if (!owner) return Promise.resolve(null)
    const pollKey = `${owner}:${operationId}`
    const existing = activeBookPolls.current.get(pollKey)
    if (existing) return existing
    const current = () => remoteAuth.current.owner === owner
    const pending = (async () => {
      let lastState = ''
      try {
        const book = await pollBookOperation({
          current, attempts: 300,
          read: async () => {
            const token = remoteAuth.current.token
            if (!current() || !token) return null
            const result = await apiFetch<{ book: Record<string, unknown> | null }>(`/api/books/operations/${operationId}`, { accessToken: token })
            return result.book ? mapRemoteBook(result.book) : null
          },
          observe: async book => {
            if (lastState !== book.state) {
              if (!await refreshBookShelf(owner)) throw new Error('BOOK_REFRESH_UNCONFIRMED')
              lastState = book.state
            }
          },
          sleep: () => new Promise(resolve => window.setTimeout(resolve, 2000)),
        })
        if (!current()) return null
        if (!book) {
          setState(s => ({ ...s, bookRefreshError: '作成状況の自動確認を一旦止めました。作成をやり直さず、再読み込みで確認してください。' }))
          return null
        }
        // Completion of this operation cannot erase a newer operation's cache.
        const key = pendingBookKey(owner)
        try {
          const saved = JSON.parse(window.localStorage.getItem(key) ?? 'null')
          if (saved?.operationId === operationId) window.localStorage.removeItem(key)
        } catch { /* Keep uncertain recovery data. */ }
        return book.id
      } catch (error) {
        if (current()) setState(s => ({ ...s, bookRefreshError: '作成状況を取得できませんでした。作成をやり直さず、再読み込みで確認してください。' }))
        throw error
      }
    })().finally(() => { activeBookPolls.current.delete(pollKey) })
    activeBookPolls.current.set(pollKey, pending)
    return pending
  }, [refreshBookShelf])

  // Covers older accepted jobs whose operation cache was already cleared, too.
  const shelfOwner = remoteAuth.current.owner
  const pendingShelfIds = state.books.filter(b => isBookPending(b.state) && /^[a-f\d]{8}-[a-f\d-]{27}$/i.test(b.id)).map(b => b.id).sort().join(',')
  useEffect(() => {
    if (!REMOTE || !shelfOwner || !pendingShelfIds || activeBookPolls.current.size > 0) return
    let cancelled = false
    void (async () => {
      for (let i = 0; i < 300 && !cancelled && remoteAuth.current.owner === shelfOwner; i++) {
        try {
          await refreshBookShelf(shelfOwner)
          if (!stateRef.current.books.some(b => isBookPending(b.state))) return
        } catch {
          if (!cancelled && remoteAuth.current.owner === shelfOwner) setState(s => ({ ...s, bookRefreshError: '作成状況を取得できませんでした。再読み込みで確認できます。' }))
        }
        await new Promise(resolve => window.setTimeout(resolve, 2000))
      }
      if (!cancelled && remoteAuth.current.owner === shelfOwner) setState(s => ({ ...s, bookRefreshError: '作成状況の自動確認を一旦止めました。再読み込みで確認してください。' }))
    })()
    return () => { cancelled = true }
  }, [shelfOwner, pendingShelfIds, bookPollRevision, refreshBookShelf])
  const remoteCreateBook = useCallback(async (draft: AppState['draft']) => {
    if (!webAiAdult(stateRef.current.profile?.birthDate)) throw new Error(WEB_AI_ADULT_NOTICE)
    const accessToken = await remoteToken()
    if (!accessToken) throw new Error('もとになる読みものを確認できませんでした')
    const owner = remoteAuth.current.owner
    const current = () => Boolean(owner && remoteAuth.current.owner === owner)
    if (!current()) throw new Error('BOOK_OWNER_CHANGED')
    const pair = draft.sourceHref.match(/^\/couple\/([^?]+)\?year=(\d{4})$/)
    if (pair) {
      const selfId = stateRef.current.selfSourceId
      if (!selfId) throw new Error('本人の読みものを確認できませんでした')
      const saved = await apiFetch<{ sourceId: string; sourceCardId: string }>(`/api/reading/${selfId}/partners/${pair[1]}/couple-timeline`, { method: 'POST', accessToken, body: JSON.stringify({ year: Number(pair[2]) }) })
      if (!current()) throw new Error('BOOK_OWNER_CHANGED')
      setState(s => ({ ...s, bookSourcePartners: { ...s.bookSourcePartners, [saved.sourceId]: pair[1] } }))
      draft = { ...draft, ...saved }
    }
    if (!draft.sourceId) throw new Error('もとになる読みものを確認できませんでした')
    const operationId = newOperationId()
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!current() || userId !== owner) throw new Error('BOOK_OWNER_CHANGED')
    if (userId) window.localStorage.setItem(pendingBookKey(userId), JSON.stringify({ operationId, draft }))
    try {
      await apiFetch('/api/books/validate', { method: 'POST', accessToken, aiConsent: true, body: JSON.stringify({ sourceId: draft.sourceId, focusCardId: draft.sourceCardId, theme: draft.theme, question: draft.question }) })
      if (!current()) throw new Error('BOOK_OWNER_CHANGED')
      await apiFetch('/api/books', { method: 'POST', accessToken, aiConsent: true, body: JSON.stringify({ operationId, sourceId: draft.sourceId, focusCardId: draft.sourceCardId, theme: draft.theme, question: draft.question }) })
      if (!current()) return null
      return await pollRemoteBook(operationId, accessToken)
    } catch (error) {
      if (current()) setState(s => ({ ...s, bookRefreshError: '作成の受付・状況を確認できませんでした。作成をやり直さず、再読み込みで確認してください。' }))
      throw error
    }
  }, [pollRemoteBook, remoteToken])

  // Reloading the page must not strand a submitted book. The operation id is
  // user-scoped and the server remains idempotent, so recovery is safe.
  useEffect(() => {
    if (!REMOTE) return
    let cancelled = false
    void (async () => {
      const session = (await supabase.auth.getSession()).data.session
      if (!session) return
      const pending = window.localStorage.getItem(pendingBookKey(session.user.id))
      if (!pending) return
      try {
        const parsed = JSON.parse(pending) as { operationId?: string }
        if (!cancelled && parsed.operationId) await pollRemoteBook(parsed.operationId, session.access_token)
      } catch { /* The retry button remains available if recovery cannot finish. */ }
    })()
    return () => { cancelled = true }
  }, [pollRemoteBook, bookPollRevision])

  // Pending partner data is restored as a draft only. Reload must never silently
  // delete/register a partner; recovery requires another explicit form submit.
  const remoteSaveProfile = useCallback(async (profile: BirthProfile) => {
    let token = await remoteToken()
    if (!token) {
      const captchaToken = await requestCaptchaToken(import.meta.env.VITE_TURNSTILE_SITE_KEY)
      const result = await supabase.auth.signInAnonymously({ options: captchaToken ? { captchaToken } : undefined })
      if (result.error || !result.data.session) throw result.error ?? new Error('匿名アカウントを作成できませんでした')
      token = result.data.session.access_token
    }
    const assertOwner = () => {
      if (remoteAuth.current.token !== token || profileSaveOwner.current !== remoteAuth.current.owner) throw new Error('ログイン状態が変わりました。もう一度お試しください。')
    }
    assertOwner()
    const operationId = newOperationId()
    await apiFetch('/api/calc/divination', { method: 'POST', accessToken: token, body: JSON.stringify({ birthDate: profile.birthDate, birthTime: profile.birthTime, birthplace: profile.birthPlace, gender: profile.gender }) })
    assertOwner()
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}${webApiPath('/api/preview/generate?format=sse')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': operationId },
      body: JSON.stringify({ birthDate: profile.birthDate, birthTime: profile.birthTime, birthplace: profile.birthPlace, gender: profile.gender, nickname: profile.nickname }),
    })
    const text = await response.text()
    assertOwner()
    if (!response.ok) throw new Error('読みものを生成できませんでした')
    const complete = [...text.matchAll(/data: (\{.*\})/g)].map(m => JSON.parse(m[1]) as { type?: string; report?: Record<string, unknown> }).find(x => x.type === 'complete')
    if (!complete?.report) throw new Error('生成結果を確認できませんでした')
    const report = complete.report
    await apiFetch('/api/reading/conversations', { method: 'POST', accessToken: token, headers: { 'Idempotency-Key': operationId }, body: JSON.stringify({ birthData: { ...profile, birthplace: profile.birthPlace }, calculatedData: report.calculatedData ?? {}, reportText: String(report.reportText ?? JSON.stringify(report)), structuredReport: report, sourceSection: 'あなたについて' }) })
    assertOwner()
    return token
  }, [remoteToken])

  const actions = useMemo<Actions>(() => ({
    reloadReadings: () => { setBookPollRevision(n => n + 1); const token = remoteAuth.current.token; if (token) void refreshRemote(token) },
    saveMeetingYear: async (id, year) => {
      const token = remoteAuth.current.token, selfId = stateRef.current.selfSourceId
      if (!token || !selfId) throw new Error('本人の読みものを確認できませんでした。')
      await apiFetch(`/api/reading/couple-timeline-settings/${id}?selfReadingId=${selfId}`, { method: 'PATCH', accessToken: token, body: JSON.stringify({ meetingYear: year }) })
      await refreshRemote(token)
    },
    linkEmail: email => {
      if (REMOTE) { void supabase.auth.updateUser({ email }); return }
      setState(s => ({ ...s, session: 'linked', email }))
    },
    restore: email => {
      if (REMOTE) { void supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }); return }
      // 本番：signInWithOtp({ email, options: { shouldCreateUser: false } }) → verifyOtp({ email, token, type: 'email' })
      storeDraftQuestion('')
      clearTimers()
      setState({ ...initialState(), session: 'linked', email, receiptEmail: email })
    },
    forgetDevice: () => {
      // 共用のパソコンで次の人に見えないよう、下書きも消す
      storeDraftQuestion('')
      clearTimers()
      if (REMOTE) { void supabase.auth.signOut(); return }
      setState(blankState())
    },
    saveProfile: async profile => {
      if (!REMOTE) {
        setState(s => ({ ...s, years: mockYears, chapters: mockChapters, personaTitle: mockPersonaTitle, profile, session: s.session === 'none' ? 'anonymous' : s.session, showGuide: s.profile ? s.showGuide : true }))
        return
      }
      if (profileSaveInProgress.current) throw new Error('読みものを作成中です。')
      profileSaveInProgress.current = true
      profileSaveOwner.current = remoteAuth.current.owner
      // Invalidate an older empty-history refresh before starting persistence.
      refreshSequence.current++
      try {
        const token = await remoteSaveProfile(profile)
        // The server is now the source of truth. Never hydrate a different
        // account, even if a sign-in/sign-out happened during the request.
        if (remoteAuth.current.token !== token) throw new Error('ログイン状態が変わりました。')
        setState(s => ({ ...s, profile, showGuide: s.profile ? s.showGuide : true }))
        if (!await refreshRemote(token)) throw new Error('保存した読みものを読み込めませんでした。')
      } finally {
        profileSaveInProgress.current = false
        profileSaveOwner.current = null
      }
    },
    setPartner: async input => {
      const partner: Partner = { ...input, id: `p-${Date.now()}` }
      const old = stateRef.current.partners[0]
      if (REMOTE) {
        if (partnerSaveInProgress.current) throw new Error('登録処理中です。完了をお待ちください。')
        partnerSaveInProgress.current = true
        const owner = remoteAuth.current.owner
        let pending: PendingPartner | null = null
        let stage = 'prepare'
        const current = () => Boolean(owner && remoteAuth.current.owner === owner)
        const check = () => { if (!current()) throw new Error('ログイン状態が変わりました。') }
        try {
          const accessToken = await remoteToken()
          check()
          if (!accessToken || !owner || !stateRef.current.selfSourceId) throw new Error('AUTH_REQUIRED')
          const sourceId = stateRef.current.selfSourceId
          const key = pendingPartnerKey(owner)
          const raw = window.localStorage.getItem(key)
          pending = pendingPartnerFromRaw(raw)
          if (raw && (!partnerDraftFromRaw(raw) || (!pending && JSON.parse(raw).version === 2))) throw new Error('INVALID_PENDING')
          if (pending && JSON.stringify(pending.input) !== JSON.stringify(input)) {
            throw new Error('PENDING_INPUT_CHANGED')
          }
          if (!pending) {
            // Legacy drafts have no operation id. First reconcile the list; do
            // not interpret an already registered partner as a deletion target.
            if (raw) {
              const list = await apiFetch<{ partners: Array<{ id: string }> }>('/api/partners', { accessToken })
              check()
              if (list.partners.length) throw new Error('LEGACY_PENDING_UNCERTAIN')
            }
            pending = { version: 2, input, operationId: newOperationId(), oldPartnerId: old?.id ?? null, deleted: false }
          }
          const persist = () => { check(); window.localStorage.setItem(key, JSON.stringify(pending)) }
          persist() // If durable recovery is unavailable, stop before DELETE.
          setState(s => ({ ...s, partnerDraft: input, partnerNotice: null }))
          if (pending.oldPartnerId && !pending.deleted && !pending.registeredId) {
            stage = 'delete'
            const list = await apiFetch<{ partners: Array<{ id: string }> }>('/api/partners', { accessToken })
            check()
            if (list.partners.some(p => p.id !== pending!.oldPartnerId)) throw new Error('PARTNER_CHANGED')
            if (list.partners.some(p => p.id === pending!.oldPartnerId)) {
              await apiFetch<void>(`/api/partners/${pending.oldPartnerId}`, { method: 'DELETE', accessToken })
              check()
            }
            pending.deleted = true
            persist()
            const removedId = pending.oldPartnerId
            setState(s => ({ ...s,
              partners: s.partners.filter(p => p.id !== removedId),
              savedIds: s.savedIds.filter(id => !id.startsWith(savedKey.couplePrefix(removedId!))),
              draft: s.draft.sourceHref.startsWith(`/couple/${removedId}`)
                ? { ...s.draft, sourceId: undefined, sourceCardId: undefined, sourceTitle: '', sourceSub: '', sourceHref: '' } : s.draft,
            }))
          }
          stage = 'register'
          if (!pending.registeredId) {
            const result = await apiFetch<{ partner?: { id: string } }>('/api/partners', { method: 'POST', accessToken, headers: { 'Idempotency-Key': pending.operationId }, body: JSON.stringify({ ...input, displayName: input.name, birthplace: input.birthPlace, relationshipLabel: input.relation, relationshipType: relationGroup(input.relation) }) })
            check()
            if (!result.partner?.id) throw new Error('PARTNER_MISSING')
            pending.registeredId = result.partner.id
            persist()
          }
          stage = 'meeting_year'
          await apiFetch(`/api/reading/couple-timeline-settings/${pending.registeredId}?selfReadingId=${sourceId}`, { method: 'PATCH', accessToken, body: JSON.stringify({ meetingYear: input.metYear }) })
          check()
          stage = 'refresh'
          if (!await refreshRemote(accessToken)) throw new Error('REFRESH_FAILED')
          check()
          window.localStorage.removeItem(key)
          setState(s => ({ ...s, partnerDraft: null, partnerNotice: null }))
          return { ...input, id: pending.registeredId }
        } catch {
          if (current()) {
            const notice = pending?.registeredId
              ? stage === 'refresh' ? '相手は登録済みです。年表を読み込めませんでした。入力を残しています。もう一度押すと登録を重複させずに再確認します。'
                : '相手は登録済みです。出会った年を保存できませんでした。入力を残しています。もう一度押すと年の保存だけを再試行します。'
              : pending?.deleted ? '前の相手は削除済みです。新しい相手の登録結果を確認できませんでした。入力を残しています。同じ入力でもう一度登録してください。'
                : stage === 'delete' ? '前の相手の削除結果を確認できませんでした。入力を残しています。同じ入力でもう一度押すと、現在の登録状況から確認します。'
                  : '登録を開始できませんでした。前の操作が残っている場合は、その入力で再確認してください。'
            setState(s => ({ ...s, partnerDraft: pending?.input ?? input, partnerNotice: notice }))
          }
          throw new Error('登録を完了できませんでした。入力を残しているので、案内を確認してください。')
        } finally { partnerSaveInProgress.current = false }
      }
      setState(s => {
        // 前の相手の年表は保存一覧からも外す。前の相手について作ったブックは本棚に残す
        const prefixes = s.partners.map(p => savedKey.couplePrefix(p.id))
        const savedIds = s.savedIds.filter(id => !prefixes.some(prefix => id.startsWith(prefix)))
        // 書きかけの相談のもとが前の相手なら、新しい相手の同じ年に差し替える（相談文はそのまま）
        const draftOnOldPartner = s.partners.some(p => s.draft.sourceHref.startsWith(`/couple/${p.id}`))
        const draft = draftOnOldPartner ? { ...s.draft, ...(REMOTE ? { sourceId: undefined, sourceCardId: undefined, sourceTitle: '', sourceSub: '', sourceHref: '' } : defaultDraftSource(partner, Number(new URLSearchParams(s.draft.sourceHref.split('?')[1]).get('year')) || 2026)) } : s.draft
        return { ...s, partners: [partner], savedIds, draft, coupleYears: REMOTE ? {} : { [partner.id]: mockCoupleYears }, coupleStatus: { [partner.id]: REMOTE ? 'loading' : 'ready' } }
      })
      return partner
    },
    setDraft: draft => setState(s => {
      const next = { ...s.draft, ...draft }
      if (draft.question !== undefined) {
        if (REMOTE) storeDraftQuestionForUser(next.question, remoteAuth.current.owner ?? undefined)
        else storeDraftQuestion(next.question)
      }
      return { ...s, draft: next }
    }),
    createBook: () => {
      if (!canCreateWithCredits(stateRef.current.credits)) throw new Error('利用できる冊数がありません。相談は下書きに残っています。')
      const draft = { ...stateRef.current.draft }
      const created = createBookNow()
      if (REMOTE) void remoteCreateBook(draft).catch(() => { /* Unknown results remain recoverable; never pretend server failure. */ })
      return created
    },
    retryBook: bookId => {
      if (REMOTE) {
        const current = stateRef.current.books.find(b => b.id === bookId)
        if (current?.sourceId) void remoteCreateBook({ ...stateRef.current.draft, sourceId: current.sourceId, sourceCardId: current.sourceCardId, sourceTitle: current.sourceTitle, sourceSub: current.sourceSub, sourceHref: current.sourceHref, theme: current.theme, question: current.question }).then(() => remoteToken().then(token => { if (token) return refreshRemote(token) })).catch(() => undefined)
        return
      }
      setState(s => ({ ...s, credits: s.credits - 1, books: s.books.map(b => b.id === bookId ? { ...b, state: 'generating', progress: 10, failureCode: undefined } : b) }))
      deliverLater(bookId)
    },
    purchase: (planId, receiptEmail) => {
      // REMOTE must await a future checkout provider and server-confirmed credits.
      // Even payments=true must NEVER run the demo grant timer.
      if (!simulatePurchase) return false
      const plan = plans.find(p => p.id === planId)
      if (!plan) return false
      setState(s => ({ ...s, receiptEmail }))
      // 実際は決済会社の画面から戻り、Webhookで付与された後に残り冊数が増える
      const t = window.setTimeout(() => setState(s => ({ ...s, credits: s.credits + plan.credits, purchasedEver: true })), 2500)
      timers.current.push(t)
      return true
    },
    toggleSaved: id => {
      const isSaved = stateRef.current.savedIds.includes(id)
      setState(s => ({ ...s, savedIds: isSaved ? s.savedIds.filter(x => x !== id) : [...s.savedIds, id] }))
      if (REMOTE) void remoteToken().then(accessToken => { if (accessToken) return apiFetch(`/api/reading/saves/${encodeURIComponent(id)}`, { method: 'PUT', accessToken, body: JSON.stringify({ isSaved: !isSaved }) }).then(() => refreshRemote(accessToken)) }).catch(() => undefined)
    },
    consumeBookQuestion: bookId => setState(s => ({ ...s, books: s.books.map(b => b.id === bookId ? { ...b, questionsLeft: Math.max(0, b.questionsLeft - 1) } : b) })),
    acceptAiConsent: () => setState(s => ({ ...s, aiConsented: true })),
    dismissGuide: () => setState(s => ({ ...s, showGuide: false })),
    requestCreateAfterPurchase: () => { if (paymentsAvailable) setState(s => ({ ...s, pendingCreate: true })) },
    cancelPendingCreate: () => setState(s => (s.pendingCreate ? { ...s, pendingCreate: false } : s)),
    startPendingBook: () => {
      if (!paymentsAvailable) return null
      const s = stateRef.current
      if (!s.pendingCreate || s.credits <= 0) return null
      const length = countChars(s.draft.question)
      if (length < 20 || length > 400 || bookQuestionProblem(s.draft.question)) { setState(prev => ({ ...prev, pendingCreate: false })); return null }
      setState(prev => ({ ...prev, pendingCreate: false }))
      const draft = { ...s.draft }
      const created = createBookNow()
      if (REMOTE) void remoteCreateBook(draft).catch(() => { /* Preserve the pending operation on uncertain responses. */ })
      return created
    },
    deleteAccount,
    applyDemo: preset => {
      if (REMOTE) return
      clearTimers()
      const base = initialState()
      if (preset === 'no-partner') Object.assign(base, { partners: [], draft: { ...defaultDraftSource(undefined), question: '' } })
      if (preset === 'zero-credits') Object.assign(base, { credits: 0, books: [], purchasedEver: false })
      if (preset === 'book-failed') base.books = [mockFailedBook, ...mockBooks.filter(b => b.state === 'delivered')]
      if (preset === 'first-visit') Object.assign(base, blankState())
      if (preset === 'linked') Object.assign(base, { session: 'linked', email: 'name@example.com' })
      setState(base)
      base.books.filter(b => b.state === 'generating').forEach(b => deliverLater(b.id))
    },
  }), [deliverLater, createBookNow, refreshRemote, remoteCreateBook, remoteToken, deleteAccount])

  const value = useMemo(() => ({ ...state, books: REMOTE ? state.books.map(book => resolveBookSource(book, state)) : state.books, ...actions }), [state, actions])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useApp must be used inside AppStateProvider')
  return value
}
