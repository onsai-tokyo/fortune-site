import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Avoid native time pickers, which can fail in iOS Home Screen apps. */
export function BirthTimeFields({ id, value, onChange, hint }: {
  id: string; value: string; onChange: (value: string) => void; hint?: ReactNode
}) {
  const [parts, setParts] = useState(() => value ? value.split(':') : ['', ''])
  const emitted = useRef(value)
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value
      setParts(value ? value.split(':') : ['', ''])
    }
  }, [value])
  const update = (next: string[]) => {
    setParts(next)
    const [hour, minute] = next
    const valid = /^\d{1,2}$/.test(hour) && Number(hour) < 24 && /^\d{1,2}$/.test(minute) && Number(minute) < 60
    emitted.current = valid ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : ''
    onChange(emitted.current)
  }
  const filled = parts.some(Boolean)
  return <fieldset id={id} aria-describedby={`${id}-hint`} className="m-0 min-w-0 border-0 p-0">
    <legend className="text-[13px] font-medium text-fl-body">出生時刻（任意）</legend>
    <div className="mb-1 flex justify-end">
      <button type="button" aria-label="出生時刻（任意）をリセット" disabled={!filled}
        onClick={() => update(['', ''])} className="min-h-[44px] px-2 text-xs text-fl-body underline disabled:opacity-50">リセット</button>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {['時', '分'].map((unit, index) => <label key={unit} htmlFor={`${id}-${index}`} className="flex min-w-0 items-center gap-2 text-sm text-fl-body">
        <span className="sr-only">生まれた{unit}</span>
        <input id={`${id}-${index}`} aria-label={`生まれた${unit}`} type="text" inputMode="numeric" autoComplete="off" maxLength={2}
          required={filled} pattern={index === 0 ? '([01]?[0-9]|2[0-3])' : '[0-5]?[0-9]'}
          title={index === 0 ? '0〜23の時を入力してください' : '0〜59の分を入力してください'}
          placeholder={index === 0 ? '例：09' : '例：30'} value={parts[index] ?? ''} aria-describedby={`${id}-hint`}
          onChange={event => update(parts.map((part, i) => i === index ? event.target.value.replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0)) : part))}
          onBlur={() => { if (/^\d$/.test(parts[index])) update(parts.map((part, i) => i === index ? part.padStart(2, '0') : part)) }}
          className="min-h-[52px] w-full min-w-0 rounded-field border border-fl-line bg-white px-3 text-base text-fl-ink placeholder:text-fl-muted" />
        <span>{unit}</span>
      </label>)}
    </div>
    <p id={`${id}-hint`} className="mb-0 mt-2 text-xs leading-[1.7] text-fl-muted">24時間表記で入力してください（午後3時 → 15時00分）。分からない場合は両方空欄で進めます。{hint && <> {hint}</>}</p>
  </fieldset>
}
