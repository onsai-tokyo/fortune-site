import type { TimelineV3Input } from './signals.js'
/** Golden samples (birth data only; the same births the existing repository tests use). The first three anchor the reference-point test (IMPLEMENTATION.md §9); no real life events are stored here. The rest cover input variants. */
export const TIMELINE_V3_SAMPLES: Record<string, TimelineV3Input> = {
  nagoya_1995_female: { birthDate: '1995-02-20', birthTime: '03:02', birthplace: '愛知県名古屋市', gender: 'female', workContext: 'employed', relationshipStatus: 'single' },
  aichi_1995_female_married: { birthDate: '1995-03-16', birthTime: '00:52', birthplace: '愛知県', gender: 'female', workContext: 'employed', relationshipStatus: 'married' },
  saga_1997_female_partnered: { birthDate: '1997-07-30', birthTime: '18:30', birthplace: '佐賀県', gender: 'female', workContext: 'employed', relationshipStatus: 'partnered' },
  nagoya_1995_female_no_time: { birthDate: '1995-02-20', birthplace: '愛知県', gender: 'female', workContext: 'employed' },
  tokyo_1990_male_independent: { birthDate: '1990-11-05', birthTime: '14:40', birthplace: '東京都', gender: 'male', workContext: 'independent', relationshipStatus: 'partnered' },
  osaka_2005_female_student: { birthDate: '2005-05-05', birthTime: '07:15', birthplace: '大阪府', gender: 'female', workContext: 'student', relationshipStatus: 'single' },
  hokkaido_1988_unknown_gender: { birthDate: '1988-08-08', birthTime: '21:00', birthplace: '北海道' },
}
export const SAMPLE_RANGE = { from: 2010, to: 2045, nowYear: 2026 }

/** Synthetic life events for fixtures (made up; no real events are stored). Covers every kind and the Jan/Feb boundary. */
export const SAMPLE_EVENTS: Record<string, Array<{ year: number; month?: number; kind: string }>> = {
  nagoya_1995_female: [{ year: 2015, kind: 'encounter' }, { year: 2017, month: 1, kind: 'start' }, { year: 2019, month: 2, kind: 'breakup' }, { year: 2022, kind: 'job' }, { year: 2025, kind: 'move' }],
  aichi_1995_female_married: [{ year: 2016, kind: 'reunion' }, { year: 2020, month: 6, kind: 'marriage' }, { year: 2023, kind: 'other' }],
  saga_1997_female_partnered: [{ year: 2019, kind: 'study' }, { year: 2022, month: 10, kind: 'start' }],
  nagoya_1995_female_no_time: [{ year: 2016, kind: 'breakup' }, { year: 2021, kind: 'job' }],
  tokyo_1990_male_independent: [{ year: 2014, kind: 'marriage' }, { year: 2021, kind: 'divorce' }, { year: 2024, month: 4, kind: 'move' }],
  osaka_2005_female_student: [{ year: 2024, month: 4, kind: 'study' }],
  hokkaido_1988_unknown_gender: [{ year: 2012, kind: 'start' }, { year: 2018, kind: 'job' }],
}

/** Couple samples: the sample "self" births paired with synthetic partners, one per relationship label. */
export const COUPLE_SAMPLES: Record<string, { self: TimelineV3Input; partner: TimelineV3Input; relationshipLabel: string; meetingYear: number }> = {
  partnered: { self: TIMELINE_V3_SAMPLES.nagoya_1995_female, partner: { birthDate: '1993-06-10', birthTime: '08:20', birthplace: '東京都', gender: 'male' }, relationshipLabel: 'お付き合い中', meetingYear: 2021 },
  engaged: { self: TIMELINE_V3_SAMPLES.saga_1997_female_partnered, partner: { birthDate: '1996-01-25', birthTime: '23:10', birthplace: '福岡県', gender: 'male' }, relationshipLabel: '婚約中', meetingYear: 2020 },
  married: { self: TIMELINE_V3_SAMPLES.aichi_1995_female_married, partner: { birthDate: '1992-09-03', birthplace: '愛知県', gender: 'male' }, relationshipLabel: '夫婦', meetingYear: 2017 },
  crush: { self: TIMELINE_V3_SAMPLES.tokyo_1990_male_independent, partner: { birthDate: '1994-12-12', birthTime: '12:00', birthplace: '神奈川県', gender: 'female' }, relationshipLabel: '片思い', meetingYear: 2024 },
  former: { self: TIMELINE_V3_SAMPLES.nagoya_1995_female, partner: { birthDate: '1994-04-01', birthTime: '06:45', birthplace: '岐阜県', gender: 'male' }, relationshipLabel: '元恋人', meetingYear: 2018 },
  friend: { self: TIMELINE_V3_SAMPLES.osaka_2005_female_student, partner: { birthDate: '2005-10-20', birthTime: '15:30', birthplace: '大阪府', gender: 'female' }, relationshipLabel: '友人', meetingYear: 2018 },
}
