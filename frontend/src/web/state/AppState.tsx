import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { bookQuestionProblem, countChars, defaultDraftSource, initialSavedIds, mockBooks, mockFailedBook, mockPartners, mockProfile, mockChapters, mockYears, plans, QUESTIONS_PER_BOOK, savedKey, relationGroup } from '../data/mock'
import { images } from '../data/images'
import type { BirthProfile, Book, BookTheme, Chapter, Partner, PlanId, ReadingSection, YearReading } from '../data/types'
import { supabase } from '../../lib/supabase'
import { apiFetch, newOperationId, webApiPath } from '../data/api'
import { requestCaptchaToken } from '../../lib/turnstile'
import { canCreateWithCredits } from '../data/paymentPolicy'
import { simulatePurchase, paymentsAvailable } from '../data/paymentConfig'

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
  session: Session
  /** 引き継ぎ用にひも付けたメール（linked のときだけ） */
  email: string | null
  /** 決済時に入力した領収書の送り先。未ひも付けなら、引き継ぎの設定に使う */
  receiptEmail: string | null
  profile: BirthProfile | null
  partners: Partner[]
  partnerNotice: string | null
  credits: number
  books: Book[]
  savedIds: string[]
  years: YearReading[]
  chapters: Chapter[]
  /** AIへの情報送信への同意（iOS AISharingConsent と同じく、一度同意すれば以後の相談・質問に適用。本番はサーバーに版つきで保存） */
  aiConsented: boolean
  draft: { sourceTitle: string; sourceSub: string; sourceHref: string; sourceId?: string; theme: BookTheme; question: string }
  /** 一度でも買ったことがあるか（ないうちはヘッダーに残り冊数を出さない） */
  purchasedEver: boolean
  /** はじめて読みものができた直後の案内を出すか */
  showGuide: boolean
  /** 「書いてから払う」：支払いが反映されたら、書いた相談でそのままブックをつくる */
  pendingCreate: boolean
}

interface Actions {
  /** 引き継ぎ用メールをひも付ける（コード確認後） */
  linkEmail: (email: string) => void
  /** 別の端末で使っていた本棚を、メールのコードで開く */
  restore: (email: string) => void
  /** この端末での利用をやめる（linked のときだけ。メールで戻れる） */
  forgetDevice: () => void
  saveProfile: (profile: BirthProfile) => void
  /** 相手は1人だけ。登録すると前の相手と入れ替わる（何度でも無料） */
  setPartner: (partner: Omit<Partner, 'id'>) => Partner
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
  deleteAccount: () => void
  applyDemo: (preset: DemoPreset) => void
}

export type DemoPreset = 'default' | 'first-visit' | 'linked' | 'no-partner' | 'zero-credits' | 'book-failed'

const DRAFT_KEY = 'fatelab:web:compose-draft:v1'
const pendingBookKey = (userId: string) => `fatelab:web:pending-book:${userId}:v1`
const pendingPartnerKey = (userId: string) => `fatelab:web:pending-partner:${userId}:v1`

function initialState(): AppState {
  if (REMOTE) return createBlankState()
  return {
    session: 'anonymous',
    email: null,
    receiptEmail: 'name@example.com',
    profile: mockProfile,
    partners: mockPartners,
    partnerNotice: null,
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
  return { session: 'none', email: null, receiptEmail: null, profile: null, partners: [], partnerNotice: null, books: [], savedIds: [], years: [], chapters: [], credits: 0, aiConsented: false, draft: { ...defaultDraftSource(undefined), question: '' }, purchasedEver: false, showGuide: false, pendingCreate: false }
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
  storeDraftQuestion(question)
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
  try { return window.localStorage.getItem(`${DRAFT_KEY}:${userId}`) ?? window.localStorage.getItem(DRAFT_KEY) ?? '' } catch { return '' }
}

const Ctx = createContext<(AppState & Actions) | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const s = initialState()
    s.draft.question = loadDraftQuestion()
    return s
  })
  const timers = useRef<number[]>([])
  const stateRef = useRef(state)
  stateRef.current = state

  const clearTimers = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = [] }
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), [])

  const refreshRemote = useCallback(async (accessToken: string) => {
    try {
      const [history, status, partners, bookshelf, saved] = await Promise.all([
        apiFetch<{ conversations: Array<Record<string, unknown>> }>('/api/reading/conversations', { accessToken }),
        apiFetch<{ remaining: number; purchasedRemaining?: number }>('/api/books/status', { accessToken }),
        apiFetch<{ partners: Array<Record<string, unknown>> }>('/api/partners', { accessToken }),
        apiFetch<{ books: Array<Record<string, unknown>> }>('/api/books', { accessToken }),
        apiFetch<{ saves: Array<{ save_key: string }> }>('/api/reading/saves', { accessToken }),
      ])
      const first = history.conversations?.find(c => c.kind !== 'chat')
      const [timing, cards] = first?.id ? await Promise.all([
        apiFetch<{ cards: Array<Record<string, unknown>> }>('/api/reading/' + first.id + '/timing-history', { accessToken }),
        apiFetch<{ cards: Array<Record<string, unknown>> }>('/api/reading/' + first.id + '/cards', { accessToken }),
      ]) : [{ cards: [] }, { cards: [] }]
      const birth = first?.birth_data as Record<string, unknown> | undefined
      const profile = birth ? {
        nickname: String(birth.nickname ?? ''), birthDate: String(birth.birthDate ?? birth.birth_date ?? ''),
        birthTime: typeof birth.birthTime === 'string' ? birth.birthTime : null,
        birthPlace: String(birth.birthplace ?? birth.birthPlace ?? '東京都'),
        gender: birth.gender === 'male' ? 'male' as const : 'female' as const,
      } : null
      const books = (bookshelf.books ?? []).map(b => ({
        id: String(b.id), title: String(b.title ?? '相談のブック'), theme: String(b.theme ?? 'その他') as BookTheme,
        question: String(b.question ?? ''), createdAt: String(b.createdAt ?? b.created_at ?? ''), state: String(b.state ?? 'queued') as Book['state'],
        sourceTitle: String(b.targetTitle ?? ''), sourceSub: '', sourceHref: '/you', cover: images.starMountains,
        sourceId: typeof b.sourceId === 'string' ? b.sourceId : undefined,
        document: b.document && typeof b.document === 'object' ? b.document as Book['document'] : undefined,
        sections: Array.isArray((b.document as Record<string, unknown> | null)?.sections) ? ((b.document as Record<string, unknown>).sections as ReadingSection[]) : [],
        questionsLeft: Number(b.questionsLeft ?? 2),
      }))
      const sourceId = typeof first?.id === 'string' ? first.id : undefined
      const remoteSavedIds = (saved.saves ?? []).map(item => item.save_key)
      const years = (timing.cards ?? []).map(card => {
        const yearMatch = String(card.id ?? '').match(/(\d{4})/)
        const sections = Array.isArray(card.sections) ? card.sections as ReadingSection[] : []
        return { year: Number(yearMatch?.[1] ?? 0), label: Number(yearMatch?.[1]) === new Date().getFullYear() ? '今年' : '', title: String(card.title ?? 'この年の流れ'), tags: Array.isArray(card.tags) ? card.tags.map(String) : [], summary: String(card.summary ?? ''), sections }
      }).filter(year => year.year > 0)
      const natureImages = Object.values(images.nature)
      const chapters = (cards.cards ?? []).filter(card => card.kind !== 'timing' && card.kind !== 'chart').map((card, index) => ({
        id: String(card.id ?? `chapter-${index}`), title: String(card.title ?? '性格の章'), sub: String(card.summary ?? ''), image: natureImages[index % natureImages.length],
        sections: Array.isArray(card.sections) ? card.sections as ReadingSection[] : [],
      }))
      setState(s => ({ ...s, profile: profile?.birthDate ? profile : s.profile,
        session: s.session === 'none' ? 'anonymous' : s.session,
        credits: status.remaining ?? 0, purchasedEver: (status.purchasedRemaining ?? 0) > 0 || s.purchasedEver,
        savedIds: remoteSavedIds,
        books,
        draft: sourceId && !s.draft.sourceId ? { ...s.draft, sourceId, sourceTitle: String(first?.title ?? s.draft.sourceTitle) } : s.draft,
        partners: (partners.partners ?? []).map(p => ({ id: String(p.id), name: String(p.name ?? p.displayName ?? '相手'), relation: String(p.relationshipLabel ?? p.relation ?? 'その他') as Partner['relation'], birthDate: String(p.birthDate ?? p.birth_date ?? ''), birthTime: typeof p.birthTime === 'string' ? p.birthTime : null, birthPlace: String(p.birthPlace ?? p.birthplace ?? ''), gender: p.gender === 'male' ? 'male' : 'female', metYear: typeof p.metYear === 'number' ? p.metYear : null })), partnerNotice: null,
        years: years.length ? years : s.years, chapters: chapters.length ? chapters : s.chapters,
      }))
    } catch { /* Offline startup is recoverable on the next refresh. */ }
  }, [])

  useEffect(() => {
    if (!REMOTE) return
    let disposed = false
    void supabase.auth.getSession().then(({ data }) => {
      if (disposed || !data.session) return
      const linked = Boolean(data.session.user.email && !data.session.user.is_anonymous)
      setState(s => ({ ...s, session: linked ? 'linked' : 'anonymous', email: data.session?.user.email ?? null, draft: { ...s.draft, question: loadDraftQuestionForUser(data.session!.user.id) } }))
      void refreshRemote(data.session.access_token)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setState(blankState()); return }
      setState(s => ({ ...s, session: session.user.email && !session.user.is_anonymous ? 'linked' : 'anonymous', email: session.user.email ?? null }))
      void refreshRemote(session.access_token)
    })
    return () => { disposed = true; listener.subscription.unsubscribe() }
  }, [refreshRemote])

  const deliverLater = useCallback((bookId: string) => {
    // 実際はワーカーが生成し、/api/books/operations/:id のポーリングで完了を知る
    const t = window.setTimeout(() => {
      setState(s => ({
        ...s,
        books: s.books.map(b => b.id === bookId ? { ...b, state: 'delivered', progress: 100, sections: [{ heading: '一　この年の流れから', body: '［サンプル］選んだ読みものをもとにした答えがここに入ります。' }] } : b),
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
  const pollRemoteBook = useCallback(async (operationId: string, accessToken: string) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const result = await apiFetch<{ book: Record<string, unknown> | null }>(`/api/books/operations/${operationId}`, { accessToken })
      if (result.book) {
        const bookId = String(result.book.id)
        const key = (await supabase.auth.getUser()).data.user?.id
        if (key) window.localStorage.removeItem(pendingBookKey(key))
        await refreshRemote(accessToken)
        return bookId
      }
      await new Promise(resolve => window.setTimeout(resolve, 2000))
    }
    return null
  }, [refreshRemote])
  const remoteCreateBook = useCallback(async (draft: AppState['draft']) => {
    const accessToken = await remoteToken()
    if (!accessToken || !draft.sourceId) throw new Error('もとになる読みものを確認できませんでした')
    const operationId = newOperationId()
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (userId) window.localStorage.setItem(pendingBookKey(userId), JSON.stringify({ operationId, draft }))
    await apiFetch('/api/books/validate', { method: 'POST', accessToken, aiConsent: true, body: JSON.stringify({ sourceId: draft.sourceId, theme: draft.theme, question: draft.question }) })
    await apiFetch('/api/books', { method: 'POST', accessToken, aiConsent: true, body: JSON.stringify({ operationId, sourceId: draft.sourceId, theme: draft.theme, question: draft.question }) })
    return pollRemoteBook(operationId, accessToken)
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
  }, [pollRemoteBook])

  useEffect(() => {
    if (!REMOTE) return
    void (async () => {
      const session = (await supabase.auth.getSession()).data.session
      if (!session) return
      const pendingKey = pendingPartnerKey(session.user.id)
      const raw = window.localStorage.getItem(pendingKey)
      if (!raw) return
      try {
        const input = JSON.parse(raw) as Omit<Partner, 'id'>
        const current = await apiFetch<{ partners: Array<Record<string, unknown>> }>('/api/partners', { accessToken: session.access_token })
        // A failed DELETE leaves the old record in place; do not create a second
        // partner in that case. If the list is empty, replay the same payload.
        if ((current.partners ?? []).length === 0) {
          await apiFetch('/api/partners', { method: 'POST', accessToken: session.access_token, headers: { 'Idempotency-Key': newOperationId() }, body: JSON.stringify({ ...input, relationshipLabel: input.relation, relationshipType: relationGroup(input.relation) }) })
          window.localStorage.removeItem(pendingKey)
          await refreshRemote(session.access_token)
        }
      } catch { /* Keep the payload for the next explicit recovery attempt. */ }
    })()
  }, [refreshRemote])
  const remoteSaveProfile = useCallback(async (profile: BirthProfile) => {
    let token = await remoteToken()
    if (!token) {
      const captchaToken = await requestCaptchaToken(import.meta.env.VITE_TURNSTILE_SITE_KEY)
      const result = await supabase.auth.signInAnonymously({ options: captchaToken ? { captchaToken } : undefined })
      if (result.error || !result.data.session) throw result.error ?? new Error('匿名アカウントを作成できませんでした')
      token = result.data.session.access_token
    }
    const operationId = newOperationId()
    await apiFetch('/api/calc/divination', { method: 'POST', accessToken: token, body: JSON.stringify({ birthDate: profile.birthDate, birthTime: profile.birthTime, birthplace: profile.birthPlace, gender: profile.gender }) })
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}${webApiPath('/api/preview/generate?format=sse')}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': operationId },
      body: JSON.stringify({ birthDate: profile.birthDate, birthTime: profile.birthTime, birthplace: profile.birthPlace, gender: profile.gender, nickname: profile.nickname }),
    })
    const text = await response.text()
    if (!response.ok) throw new Error('読みものを生成できませんでした')
    const complete = [...text.matchAll(/data: (\{.*\})/g)].map(m => JSON.parse(m[1]) as { type?: string; report?: Record<string, unknown> }).find(x => x.type === 'complete')
    if (!complete?.report) throw new Error('生成結果を確認できませんでした')
    const report = complete.report
    await apiFetch('/api/reading/conversations', { method: 'POST', accessToken: token, headers: { 'Idempotency-Key': operationId }, body: JSON.stringify({ birthData: { ...profile, birthplace: profile.birthPlace }, calculatedData: report.calculatedData ?? {}, reportText: String(report.reportText ?? JSON.stringify(report)), structuredReport: report, sourceSection: 'あなたについて' }) })
  }, [remoteToken])

  const actions = useMemo<Actions>(() => ({
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
    saveProfile: profile => {
      setState(s => ({ ...s, profile, session: s.session === 'none' ? 'anonymous' : s.session, showGuide: s.profile ? s.showGuide : true }))
      if (REMOTE) void remoteSaveProfile(profile).then(() => remoteToken().then(token => { if (token) return refreshRemote(token) })).catch(() => undefined)
    },
    setPartner: input => {
      const partner: Partner = { ...input, id: `p-${Date.now()}` }
      if (REMOTE) {
        void remoteToken().then(async accessToken => {
          if (!accessToken) return
          const userId = (await supabase.auth.getUser()).data.user?.id
          if (userId) window.localStorage.setItem(pendingPartnerKey(userId), JSON.stringify(input))
          const old = stateRef.current.partners[0]
          let deleted = false
          try {
            if (old) { await apiFetch(`/api/partners/${old.id}`, { method: 'DELETE', accessToken }); deleted = true }
            await apiFetch('/api/partners', { method: 'POST', accessToken, headers: { 'Idempotency-Key': newOperationId() }, body: JSON.stringify({ ...input, relationshipLabel: input.relation, relationshipType: relationGroup(input.relation) }) })
            if (userId) window.localStorage.removeItem(pendingPartnerKey(userId))
            // Keep the local placeholder until the next explicit refresh so the navigation route remains usable.
          } catch {
            if (userId) window.localStorage.setItem(pendingPartnerKey(userId), JSON.stringify(input))
            if (deleted) setState(s => ({ ...s, partners: [], partnerNotice: '前の相手は削除済みです。新しい相手の登録に失敗しました。入力内容を保持しているので、もう一度登録してください。' }))
            else if (old) setState(s => ({ ...s, partners: [old], partnerNotice: '相手の入れ替えを開始できませんでした。前の相手は残っています。' }))
          }
        })
      }
      setState(s => {
        // 前の相手の年表は保存一覧からも外す。前の相手について作ったブックは本棚に残す
        const prefixes = s.partners.map(p => savedKey.couplePrefix(p.id))
        const savedIds = s.savedIds.filter(id => !prefixes.some(prefix => id.startsWith(prefix)))
        // 書きかけの相談のもとが前の相手なら、新しい相手の同じ年に差し替える（相談文はそのまま）
        const draftOnOldPartner = s.partners.some(p => s.draft.sourceHref.startsWith(`/couple/${p.id}`))
        const draft = draftOnOldPartner ? { ...s.draft, ...defaultDraftSource(partner, Number(new URLSearchParams(s.draft.sourceHref.split('?')[1]).get('year')) || 2026) } : s.draft
        return { ...s, partners: [partner], savedIds, draft }
      })
      return partner
    },
    setDraft: draft => setState(s => {
      const next = { ...s.draft, ...draft }
      if (draft.question !== undefined) {
        if (REMOTE) void supabase.auth.getUser().then(({ data }) => storeDraftQuestionForUser(next.question, data.user?.id))
        else storeDraftQuestion(next.question)
      }
      return { ...s, draft: next }
    }),
    createBook: () => {
      if (!canCreateWithCredits(stateRef.current.credits)) throw new Error('利用できる冊数がありません。相談は下書きに残っています。')
      const draft = { ...stateRef.current.draft }
      const created = createBookNow()
      if (REMOTE) void remoteCreateBook(draft).then(() => remoteToken().then(token => { if (token) return refreshRemote(token) })).catch(() => setState(s => ({ ...s, books: s.books.map(b => b.id === created.id ? { ...b, state: 'failed', failureCode: 'BOOK_UNAVAILABLE' } : b) })))
      return created
    },
    retryBook: bookId => {
      if (REMOTE) {
        const current = stateRef.current.books.find(b => b.id === bookId)
        if (current?.sourceId) void remoteCreateBook({ ...stateRef.current.draft, sourceId: current.sourceId, sourceTitle: current.sourceTitle, sourceSub: current.sourceSub, sourceHref: current.sourceHref, theme: current.theme, question: current.question }).then(() => remoteToken().then(token => { if (token) return refreshRemote(token) })).catch(() => undefined)
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
      if (REMOTE) void remoteCreateBook(draft).then(() => remoteToken().then(token => { if (token) return refreshRemote(token) })).catch(() => setState(prev => ({ ...prev, books: prev.books.map(b => b.id === created.id ? { ...b, state: 'failed', failureCode: 'BOOK_UNAVAILABLE' } : b) })))
      return created
    },
    deleteAccount: () => {
      void remoteToken().then(async accessToken => {
        if (REMOTE && accessToken) { try { await apiFetch('/api/reading/account', { method: 'DELETE', accessToken }) } catch { /* local cleanup still proceeds */ } }
        if (REMOTE) await supabase.auth.signOut()
      })
      storeDraftQuestionForUser('', undefined)
      clearTimers()
      setState(blankState())
    },
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
  }), [deliverLater, createBookNow, refreshRemote, remoteCreateBook, remoteToken])

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useApp must be used inside AppStateProvider')
  return value
}
