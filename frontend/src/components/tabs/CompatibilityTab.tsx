import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { registrationKey } from '../../lib/partnerRegistrationRecovery'
import { deletionKey } from '../../lib/partnerDeletion'
import { PartnerDeletionPanel } from '../PartnerDeletionPanel'
import { PartnerRegistrationForm } from '../PartnerRegistrationForm'
import { supabase } from '../../lib/supabase'
import { compatibilityKey, loadCompatibilityOperation, recoverCompatibility, type CompatibilityOperation } from '../../lib/compatibilityRecovery'

type Choice = { id: string; title?: string; kind?: string; display_name?: string }
const relationships: Record<string, string[]> = {
  romantic: ['片思い', 'お付き合い中', '婚約中', '夫婦', '復縁希望', '元恋人'],
  friend: ['友人', '親友', '会社の同僚', '上司', '部下', '取引先', 'その他'],
  family: ['親', '子', '兄弟姉妹', '配偶者の家族'],
}
const fieldClass = 'w-full bg-navy-light border border-white/15 rounded-lg px-3 py-3 text-white text-sm'

export function CompatibilityTab() {
  const { user, refreshPoints } = useAuth()
  const navigate = useNavigate()
  const boundary = useRef({ owner: user?.id ?? null, epoch: 0 })
  if (boundary.current.owner !== (user?.id ?? null)) boundary.current = { owner: user?.id ?? null, epoch: boundary.current.epoch + 1 }
  const [authEpoch, setAuthEpoch] = useState(0)
  const active = useRef<symbol | null>(null)
  const partnerListRevision = useRef(0)
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<{ owner: string; epoch: number; partners: Choice[]; readings: Choice[]; pending: CompatibilityOperation | null } | null>(null)
  const [error, setError] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [relationshipLabel, setRelationshipLabel] = useState('友人')
  const owner = user?.id
  const visible = state?.owner === owner && state?.epoch === boundary.current.epoch ? state : null

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || boundary.current.owner !== (session?.user.id ?? null)) {
        boundary.current = { owner: session?.user.id ?? null, epoch: boundary.current.epoch + 1 }
        active.current = null; setBusy(false); setState(null); setError(''); setAuthEpoch(value => value + 1)
      }
    })
    return () => { boundary.current.epoch++; data.subscription.unsubscribe() }
  }, [])

  function context() {
    const id = owner, epoch = boundary.current.epoch
    const current = () => !!id && boundary.current.owner === id && boundary.current.epoch === epoch
    const check = () => { if (!current()) throw new Error('ログイン状態が変更されました') }
    const authorize = async (refresh: boolean) => {
      check()
      const response = refresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession()
      check()
      if (response.error || !response.data.session || response.data.session.user.id !== id || !response.data.session.access_token) throw new Error('ログイン状態を確認してください')
      return response.data.session.access_token
    }
    return { id: id!, epoch, current, check, authorize }
  }

  useEffect(() => {
    if (!owner) return
    const ctx = context()
    let disposed = false
    const current = () => !disposed && ctx.current()
    async function load() {
      if (active.current) return
      const listRevision = ++partnerListRevision.current
      try {
        const pending = loadCompatibilityOperation(localStorage, owner!)
        if (!current()) return
        // A pending operation is recoverable even when the source/partner list is unavailable or removed.
        setState(previous => ({ owner: owner!, epoch: ctx.epoch, partners: previous && previous.owner === owner && previous.epoch === ctx.epoch ? previous.partners : [], readings: previous && previous.owner === owner && previous.epoch === ctx.epoch ? previous.readings : [], pending }))
        const read = async (path: string) => {
          for (let refreshed = false;; refreshed = true) {
            const token = await ctx.authorize(refreshed)
            const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
            ctx.check()
            if (response.status === 401 && !refreshed) continue
            if (!response.ok) throw new Error('相手と本人鑑定の一覧を取得できませんでした')
            const data = await response.json(); ctx.check(); return data
          }
        }
        const [partners, readings] = await Promise.all([read('/api/partners'), read('/api/reading/conversations')])
        if (!Array.isArray(partners.partners) || !Array.isArray(readings.conversations)) throw new Error('一覧の形式を確認できませんでした')
        if (current() && listRevision === partnerListRevision.current) setState({ owner: owner!, epoch: ctx.epoch, partners: partners.partners, readings: readings.conversations.filter((item: Choice) => item.kind === 'self'), pending: loadCompatibilityOperation(localStorage, owner!) })
      } catch (reason) { if (current()) setError(reason instanceof Error ? reason.message : '一覧を確認できませんでした') }
    }
    void load()
    const changed = (event: StorageEvent) => { if (event.key === compatibilityKey(owner!) || event.key === registrationKey(owner!) || event.key === deletionKey(owner!) || event.key === null) void load() }
    const focused = () => { void load() }
    window.addEventListener('storage', changed); window.addEventListener('focus', focused)
    return () => { disposed = true; window.removeEventListener('storage', changed); window.removeEventListener('focus', focused) }
  // The context captures this owner/epoch; SDK token refresh is handled at each request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, authEpoch])

  async function run(releaseCheckedOperation = false) {
    if (!owner || active.current) return
    const ctx = context()
    const operationToken = Symbol()
    active.current = operationToken; setBusy(true); setError('')
    try {
      if (!navigator.locks) throw new Error('このブラウザでは生成状況を安全に保存できません')
      const pending = loadCompatibilityOperation(localStorage, owner)
      const input = pending?.input ?? { partnerId, conversationId, relationshipLabel, relationshipType: Object.keys(relationships).find(key => relationships[key].includes(relationshipLabel))! }
      const id = await recoverCompatibility({ owner, input, storage: localStorage, check: ctx.check, authorize: ctx.authorize, fetcher: fetch, newID: () => crypto.randomUUID(), releaseCheckedOperation, lock: async (name, work) => await navigator.locks.request(name, work) })
      ctx.check()
      if (releaseCheckedOperation) { setPartnerId(''); setConversationId('') }
      else { void refreshPoints(); navigate(`/reading/${id}`) }
    } catch (reason) {
      if (ctx.current()) setError(reason instanceof Error ? reason.message : '相性鑑定を確認できませんでした')
    } finally {
      if (active.current === operationToken) active.current = null
      if (ctx.current()) {
        setBusy(false)
        try { const pending = loadCompatibilityOperation(localStorage, owner); setState(previous => previous ? { ...previous, pending } : null) } catch { /* Keep the error and the original pending data. */ }
      }
    }
  }

  if (!user) return <div className="glass-card p-6"><Link to="/auth" className="text-accent">ログインして相性鑑定を開く</Link></div>
  return <div className="glass-card p-6 space-y-5">
    <h2 className="text-white font-semibold text-lg">二人の相性鑑定</h2>
    <p className="text-white/50 text-sm">保存済みの「あなたについて」と登録済みの相手から作成します。新規作成は3ポイント（Premiumは消費なし）です。</p>
    {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
    {visible?.pending ? <div className="space-y-3">
      <p className="text-white/70 text-sm">前の相性鑑定が残っています。先に保存状況を確認してください。</p>
      <button disabled={busy} onClick={() => void run()} className="w-full py-3 bg-accent rounded-lg text-white disabled:opacity-40">{busy ? '確認中…' : '前の鑑定を確認・再開する'}</button>
      <button disabled={busy} onClick={() => void run(true)} className="text-white/60 text-sm underline">前の操作が終了していれば、新しい入力へ進む</button>
    </div> : <>
      <label className="block text-white/60 text-sm">本人の鑑定<select className={fieldClass} value={conversationId} disabled={busy || !visible} onChange={event => setConversationId(event.target.value)}><option value="">選択してください</option>{visible?.readings.map(item => <option key={item.id} value={item.id}>{item.title || 'あなたについて'}</option>)}</select></label>
      {visible && !visible.readings.length && <Link to="/" className="block text-accent text-sm">「あなたについて」を作成・保存する</Link>}
      <label className="block text-white/60 text-sm">登録済みの相手<select className={fieldClass} value={partnerId} disabled={busy || !visible} onChange={event => setPartnerId(event.target.value)}><option value="">選択してください</option>{visible?.partners.map(item => <option key={item.id} value={item.id}>{item.display_name || '登録済みの相手'}</option>)}</select></label>
      {visible && !visible.partners.length && <p className="text-white/50 text-sm">登録済みの相手がいません。下のフォームから登録してください。</p>}
      <label className="block text-white/60 text-sm">関係性<select className={fieldClass} value={relationshipLabel} disabled={busy} onChange={event => setRelationshipLabel(event.target.value)}>{Object.values(relationships).flat().map(label => <option key={label}>{label}</option>)}</select></label>
      <button disabled={busy || !visible || !visible.readings.some(item => item.id === conversationId) || !visible.partners.some(item => item.id === partnerId)} onClick={() => void run()} className="w-full py-3 bg-accent rounded-lg text-white disabled:opacity-40">{busy ? '鑑定を作成中…' : '相性鑑定を作成する'}</button>
    </>}
    <PartnerRegistrationForm key={`${owner}:${boundary.current.epoch}`} owner={user.id} partnerIDs={(visible?.partners??[]).map(partner=>partner.id)} onRegistered={partner=>{
      partnerListRevision.current++
      setPartnerId(partner.id)
      setRelationshipLabel(partner.relationship_label)
      setState(previous=>previous && previous.owner===owner && previous.epoch===boundary.current.epoch ? {...previous,partners:[...previous.partners.filter(item=>item.id!==partner.id),partner]} : previous)
    }} />
    <PartnerDeletionPanel key={`delete:${owner}:${boundary.current.epoch}`} owner={user.id} partners={(visible?.partners??[]).map(partner=>({id:partner.id,display_name:partner.display_name||'登録済みの相手'}))} onChanged={partners=>{
      partnerListRevision.current++
      setPartnerId(value=>partners.some(partner=>partner.id===value)?value:'')
      setState(previous=>previous && previous.owner===owner && previous.epoch===boundary.current.epoch ? {...previous,partners} : previous)
    }} />
    <Link to="/reading/history" className="block text-accent text-sm">保存済みの鑑定を見る</Link>
  </div>
}
