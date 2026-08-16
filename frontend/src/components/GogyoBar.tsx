type Values = { wood: number; fire: number; earth: number; metal: number; water: number }

const labels: Array<[keyof Values, string]> = [['wood', '木'], ['fire', '火'], ['earth', '土'], ['metal', '金'], ['water', '水']]

export default function GogyoBar({ values }: { values: Values }) {
  const maximum = Math.max(...Object.values(values), 0.01)

  return <div className="gogyo-chart" aria-label="五行バランス">
    {labels.map(([key, label]) => {
      const value = Number(values[key]) || 0
      return <div className="gogyo-row" key={key}>
        <span className="gogyo-label">{label}</span>
        <span className="gogyo-track"><span className={`gogyo-fill${value === 0 ? ' zero' : ''}`} style={{ width: value === 0 ? 1 : `${value / maximum * 100}%` }} /></span>
        <span className="gogyo-value">{value}</span>
      </div>
    })}
  </div>
}
