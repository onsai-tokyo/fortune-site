import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState'
import { IconBookmark } from './icons'

/** Anonymous readers keep reading; saving asks them to secure this account first. */
export function SaveReadingButton({ readingKey, compact = false }: { readingKey: string; compact?: boolean }) {
  const { session, savedIds, savingIds, saveErrors, toggleSaved } = useApp()
  const location = useLocation(), navigate = useNavigate()
  const saved = savedIds.includes(readingKey)
  const pending = savingIds?.includes(readingKey)
  return <span className="inline-flex flex-col items-start"><button type="button" disabled={pending} aria-busy={pending} aria-pressed={saved} aria-label={saved ? '保存を取り消す' : '本棚に保存する'}
    className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl text-fl-ink hover:bg-fl-surface ${compact ? 'w-11' : 'px-3 text-[13px]'}`}
    onClick={() => {
      if (session !== 'linked') { navigate(`/settings/link?returnTo=${encodeURIComponent(location.pathname + location.search)}&purpose=save`); return }
      toggleSaved(readingKey)
    }}>
    <IconBookmark size={18} filled={saved} />{!compact && (pending ? '保存中…' : saved ? '保存済み' : '本棚に保存')}
  </button>{saveErrors?.[readingKey] && <span role="alert" className="text-xs text-fl-danger">{saveErrors[readingKey]}</span>}</span>
}
