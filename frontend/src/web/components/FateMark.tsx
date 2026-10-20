/** iOS Theme.swift の FateMark と同じ軌道・縦軸・点の構成。 */
export function FateMark() {
  return <svg aria-hidden="true" width="28" height="28" viewBox="0 0 40 40" fill="none" className="shrink-0">
    <ellipse cx="20" cy="20" rx="19" ry="11.02" stroke="currentColor" />
    <ellipse cx="20" cy="20" rx="11.02" ry="19" transform="rotate(24 20 20)" stroke="currentColor" />
    <path d="M20 1.6v36.8" stroke="currentColor" />
    <circle cx="32.4" cy="15.2" r="1.5" fill="currentColor" />
  </svg>
}
