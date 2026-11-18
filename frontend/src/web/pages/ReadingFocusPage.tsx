import { useState } from 'react'
import { API_BASE, ApiError } from '../data/api'
import { marriageYears, type MarriageTiming } from '../data/focusResults'
import type { BirthProfile } from '../data/types'
import type { ReadingFocus } from '../data/readingFocus.js'
import { trackThreadsEvent } from '../data/threadsMeasurement'
import { CoupleIndexPage, CouplePage } from './CouplePage'
import { TopPage } from './TopPage'
import { YouPage, type PersonalFocusReading } from './YouPage'
import { YearReadingPage } from './YearReadingPage'

export function ReadingFocusPage({ focus }: { focus: ReadingFocus }) {
  const [pair, setPair] = useState<{ id: string; breakupYear?: number } | null>(null)
  const [personal, setPersonal] = useState<PersonalFocusReading | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const selectYear = (value: number | null) => { setYear(value); window.scrollTo(0, 0) }

  async function readMarriage(profile: BirthProfile, progress: (value: number) => void) {
    progress(10)
    // A public calculation endpoint: no auth, account mutation or saved reading.
    const response = await fetch(`${API_BASE}/api/calc/shichu`, {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ birthDate: profile.birthDate, birthTime: profile.birthTime, gender: profile.gender, readingFocus: 'konki' }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string }
      throw new ApiError(error.error || '婚期の計算結果を取得できませんでした。', response.status)
    }
    const data = await response.json() as { timing?: MarriageTiming }
    if (!data.timing) throw new Error('TIMING_UNAVAILABLE')
    const from = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', year: 'numeric' }).format(new Date()))
    const years = marriageYears(data.timing, from)
    progress(100)
    setPersonal({ profile, years, chapters: [], personaTitle: '' })
    window.scrollTo(0, 0)
    trackThreadsEvent('self_reading_complete')
  }

  if (focus === 'konki') {
    if (!personal) return <TopPage focus="konki" onRead={readMarriage} />
    if (year !== null) return <YearReadingPage readingYear={year} readings={personal.years} onBack={() => selectYear(null)} onSelectYear={selectYear} />
    return <YouPage reading={personal} onSelectYear={selectYear} onReadAgain={() => { setPersonal(null); selectYear(null) }} />
  }
  return pair ? <CouplePage focus={focus} partnerId={pair.id} breakupYear={pair.breakupYear} onReadAgain={() => { setPair(null); window.scrollTo(0, 0) }} />
    : <CoupleIndexPage focus={focus} onComplete={(partner, breakupYear) => { setPair({ id: partner.id, breakupYear }); window.scrollTo(0, 0) }} />
}
