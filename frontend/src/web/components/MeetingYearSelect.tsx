export function MeetingYearSelect({ id, value, onChange, label = '出会った年（必須）' }: {
  id: string
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const currentYear = new Date().getFullYear()

  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13px] font-medium text-fl-body">
      {label}
      <select id={id} required value={value} onChange={event => onChange(event.target.value)}
        className="block h-[52px] w-full rounded-field border border-fl-line bg-white px-3 text-[16px]">
        <option value="">年を選択してください</option>
        {Array.from({ length: currentYear - 1899 }, (_, index) => currentYear - index).map(year => (
          <option key={year} value={year}>{year}年</option>
        ))}
      </select>
    </label>
  )
}
