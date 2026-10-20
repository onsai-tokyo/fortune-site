export function BirthDateFields({ id, value, onChange, disabled = false }: {
  id: string; value: string; onChange: (value: string) => void; disabled?: boolean
}) {
  const [year = '', month = '', day = ''] = value.split('-')
  const update = (index: number, next: string) => {
    const parts = [year, month, day]
    parts[index] = next
    onChange(parts.join('-'))
  }
  return <fieldset id={id} className="m-0 min-w-0 border-0 p-0">
    <legend className="mb-2 text-[13px] font-medium text-fl-body">生年月日</legend>
    <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
      {[
        { label: '年', selected: year, values: Array.from({ length: new Date().getFullYear() - 1899 }, (_, i) => String(new Date().getFullYear() - i)) },
        { label: '月', selected: month, values: Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')) },
        { label: '日', selected: day, values: Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')) },
      ].map((part, i) => <label key={part.label} className="min-w-0 text-xs text-fl-muted">
        <span className="sr-only">生まれた{part.label}</span>
        <select required disabled={disabled} aria-label={`生まれた${part.label}`} value={part.selected} onChange={e => update(i, e.target.value)}
          className="min-h-[52px] w-full min-w-0 rounded-field border border-fl-line bg-white px-2 text-base">
          <option value="">{part.label}</option>
          {part.values.map(v => <option key={v} value={v}>{Number(v)}{part.label}</option>)}
        </select>
      </label>)}
    </div>
  </fieldset>
}
