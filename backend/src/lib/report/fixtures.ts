import {
  calcExpandedDivination, calcHonmeiStar, calcKyuseiProfile, calcLifePathNumber, calcNayin,
  calcNumerologyProfile, calcSanmei, calcSanmeiRelations, calcShichu, calcTimingCycles,
  getSukuyo, KYUSEI_NAMES,
} from '../divination/index.js'
import { calcZiwei } from '../ziwei.js'
import { calcAstrology } from '../astrology.js'
import type { ReportInput } from '../deterministicReport.js'

/**
 * PR-0b: 固定40件の出生条件。
 *
 * 意図的に偏らせてある。ランダムな40件では「同年生まれで似る」「同日で時刻だけ違う」
 * といった、実際に苦情になる条件が1件も入らない可能性がある。
 *
 * このリストは変更しないこと。変更するとスナップショットが全件無効になり、
 * 以降のPRの合否判定ができなくなる。追加が必要なら末尾へ足す。
 */

export type FixtureGroup = 'baseline' | 'same-year' | 'same-day' | 'time-variant' | 'no-time'

export interface BirthFixture {
  id: string
  birthDate: string
  birthTime: string | null
  birthplace: string
  gender: 'male' | 'female'
  group: FixtureGroup
  /** 同一グループ内で比較すべき相手のid。差分率の分母になる */
  compareWith?: string[]
}

export const BIRTH_FIXTURES: readonly BirthFixture[] = [
  // ── baseline 16件: 年代・季節・性別・出生地をばらけさせた基準集合 ──
  { id: 'f001', birthDate: '1968-02-14', birthTime: '05:20', birthplace: '北海道札幌市', gender: 'male', group: 'baseline' },
  { id: 'f002', birthDate: '1972-06-30', birthTime: '23:45', birthplace: '青森県青森市', gender: 'female', group: 'baseline' },
  { id: 'f003', birthDate: '1976-11-03', birthTime: '12:00', birthplace: '宮城県仙台市', gender: 'male', group: 'baseline' },
  { id: 'f004', birthDate: '1980-08-19', birthTime: '03:10', birthplace: '東京都新宿区', gender: 'female', group: 'baseline' },
  { id: 'f005', birthDate: '1983-01-07', birthTime: '17:55', birthplace: '神奈川県横浜市', gender: 'male', group: 'baseline' },
  { id: 'f006', birthDate: '1986-04-22', birthTime: '09:30', birthplace: '愛知県名古屋市', gender: 'female', group: 'baseline' },
  { id: 'f007', birthDate: '1989-09-11', birthTime: '21:05', birthplace: '京都府京都市', gender: 'male', group: 'baseline' },
  { id: 'f008', birthDate: '1991-12-25', birthTime: '06:40', birthplace: '大阪府大阪市', gender: 'female', group: 'baseline' },
  { id: 'f009', birthDate: '1994-03-08', birthTime: '14:15', birthplace: '兵庫県神戸市', gender: 'male', group: 'baseline' },
  { id: 'f010', birthDate: '1997-07-17', birthTime: '01:25', birthplace: '広島県広島市', gender: 'female', group: 'baseline' },
  { id: 'f011', birthDate: '1999-10-29', birthTime: '19:50', birthplace: '福岡県福岡市', gender: 'male', group: 'baseline' },
  { id: 'f012', birthDate: '2001-05-05', birthTime: '11:11', birthplace: '沖縄県那覇市', gender: 'female', group: 'baseline' },
  { id: 'f013', birthDate: '2003-02-28', birthTime: '08:00', birthplace: '新潟県新潟市', gender: 'male', group: 'baseline' },
  { id: 'f014', birthDate: '2005-08-01', birthTime: '16:35', birthplace: '石川県金沢市', gender: 'female', group: 'baseline' },
  { id: 'f015', birthDate: '2007-12-13', birthTime: '22:20', birthplace: '静岡県静岡市', gender: 'male', group: 'baseline' },
  { id: 'f016', birthDate: '1964-09-26', birthTime: '04:45', birthplace: '熊本県熊本市', gender: 'female', group: 'baseline' },

  // ── same-year 8件: 同年生まれ。世代天体・年柱・九星が共通するため、
  //    ここで差が出ないなら「同年代のユーザー同士が同じ鑑定書を読む」ことになる ──
  { id: 'f017', birthDate: '1995-01-19', birthTime: '07:05', birthplace: '東京都世田谷区', gender: 'female', group: 'same-year', compareWith: ['f018', 'f019', 'f020', 'f021', 'f022', 'f023', 'f024'] },
  { id: 'f018', birthDate: '1995-03-27', birthTime: '13:40', birthplace: '埼玉県さいたま市', gender: 'female', group: 'same-year', compareWith: ['f017'] },
  { id: 'f019', birthDate: '1995-05-14', birthTime: '20:15', birthplace: '千葉県千葉市', gender: 'male', group: 'same-year', compareWith: ['f017'] },
  { id: 'f020', birthDate: '1995-07-02', birthTime: '02:50', birthplace: '茨城県水戸市', gender: 'female', group: 'same-year', compareWith: ['f017'] },
  { id: 'f021', birthDate: '1995-08-23', birthTime: '10:30', birthplace: '群馬県前橋市', gender: 'male', group: 'same-year', compareWith: ['f017'] },
  { id: 'f022', birthDate: '1995-10-09', birthTime: '18:00', birthplace: '栃木県宇都宮市', gender: 'female', group: 'same-year', compareWith: ['f017'] },
  { id: 'f023', birthDate: '1995-11-30', birthTime: '23:10', birthplace: '山梨県甲府市', gender: 'male', group: 'same-year', compareWith: ['f017'] },
  { id: 'f024', birthDate: '1995-12-21', birthTime: '05:55', birthplace: '長野県長野市', gender: 'female', group: 'same-year', compareWith: ['f017'] },

  // ── same-day 6件: 同日生まれ・時刻違い。四柱の年月日柱・納音・宿曜・数秘・九星が完全一致し、
  //    差が出るのは時柱・紫微斗数・ASC/MC・月のみ。ここが潰れていると「双子が同じ鑑定書」になる ──
  { id: 'f025', birthDate: '1992-09-23', birthTime: '00:30', birthplace: '東京都港区', gender: 'female', group: 'same-day', compareWith: ['f026', 'f027', 'f028', 'f029', 'f030'] },
  { id: 'f026', birthDate: '1992-09-23', birthTime: '04:30', birthplace: '東京都港区', gender: 'female', group: 'same-day', compareWith: ['f025'] },
  { id: 'f027', birthDate: '1992-09-23', birthTime: '09:30', birthplace: '東京都港区', gender: 'female', group: 'same-day', compareWith: ['f025'] },
  { id: 'f028', birthDate: '1992-09-23', birthTime: '14:30', birthplace: '東京都港区', gender: 'female', group: 'same-day', compareWith: ['f025'] },
  { id: 'f029', birthDate: '1992-09-23', birthTime: '19:30', birthplace: '東京都港区', gender: 'female', group: 'same-day', compareWith: ['f025'] },
  { id: 'f030', birthDate: '1992-09-23', birthTime: '23:30', birthplace: '東京都港区', gender: 'female', group: 'same-day', compareWith: ['f025'] },

  // ── time-variant 6件: 同一人物の時刻を境界付近で振る。
  //    キャッシュ署名に出生時刻が入っていない不具合の再発検出用 ──
  { id: 'f031', birthDate: '1996-01-05', birthTime: '00:59', birthplace: '大阪府堺市', gender: 'male', group: 'time-variant', compareWith: ['f032'] },
  { id: 'f032', birthDate: '1996-01-05', birthTime: '01:01', birthplace: '大阪府堺市', gender: 'male', group: 'time-variant', compareWith: ['f031'] },
  { id: 'f033', birthDate: '1996-01-05', birthTime: '10:59', birthplace: '大阪府堺市', gender: 'male', group: 'time-variant', compareWith: ['f034'] },
  { id: 'f034', birthDate: '1996-01-05', birthTime: '11:01', birthplace: '大阪府堺市', gender: 'male', group: 'time-variant', compareWith: ['f033'] },
  { id: 'f035', birthDate: '1996-01-05', birthTime: '22:59', birthplace: '大阪府堺市', gender: 'male', group: 'time-variant', compareWith: ['f036'] },
  { id: 'f036', birthDate: '1996-01-05', birthTime: '23:01', birthplace: '大阪府堺市', gender: 'male', group: 'time-variant', compareWith: ['f035'] },

  // ── no-time 4件: 出生時刻なし。紫微斗数・時柱・ASC/MC が使えない分岐 ──
  { id: 'f037', birthDate: '1985-06-11', birthTime: null, birthplace: '岡山県岡山市', gender: 'female', group: 'no-time' },
  { id: 'f038', birthDate: '1993-02-02', birthTime: null, birthplace: '鹿児島県鹿児島市', gender: 'male', group: 'no-time' },
  { id: 'f039', birthDate: '2000-10-20', birthTime: null, birthplace: '三重県津市', gender: 'female', group: 'no-time' },
  { id: 'f040', birthDate: '1978-04-04', birthTime: null, birthplace: '岩手県盛岡市', gender: 'male', group: 'no-time' },
]

const CALIBRATION_PLACES = [
  '北海道札幌市', '宮城県仙台市', '東京都新宿区', '神奈川県横浜市',
  '愛知県名古屋市', '大阪府大阪市', '広島県広島市', '福岡県福岡市',
] as const

/**
 * Trait Scoreの分布校正専用コーパス。
 * 固定40件の回帰fixtureとは分離し、同じ件数なら常に同じ出生条件を返す。
 */
export function buildCalibrationFixtures(count = 1000): BirthFixture[] {
  if (!Number.isInteger(count) || count < 1) throw new Error('count must be a positive integer')
  return Array.from({ length: count }, (_, index) => {
    const year = 1955 + (index * 37) % 66
    const month = 1 + (index * 7) % 12
    const day = 1 + (index * 11) % 28
    const hour = (index * 5) % 24
    const minute = (index * 13) % 60
    const hasBirthTime = index % 5 !== 0
    return {
      id: `cal-${String(index + 1).padStart(4, '0')}`,
      birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      birthTime: hasBirthTime ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : null,
      birthplace: CALIBRATION_PLACES[index % CALIBRATION_PLACES.length],
      gender: index % 2 === 0 ? 'female' : 'male',
      group: hasBirthTime ? 'baseline' : 'no-time',
    }
  })
}

function calcAge(birthDate: string, today: Date): number {
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDelta = today.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
}

/**
 * routes/preview.ts の reportInput 構築と同じ手順を再現する。
 *
 * 【重要】preview.ts 側を変更したら、必ずこちらも合わせること。
 * 乖離すると「テストは通るが本番だけ壊れる」状態になる。
 * その乖離を検出するのが selfReportSnapshot.test.ts の
 * 「fixtureInput は preview.ts と同じ占術関数を呼ぶ」テストである。
 */
export function buildFixtureReportInput(fixture: BirthFixture, today = new Date('2026-08-24T00:00:00Z')): ReportInput {
  const [year, month, day] = fixture.birthDate.split('-').map(Number)
  const [birthHour, birthMinute] = fixture.birthTime
    ? fixture.birthTime.split(':').map(Number)
    : [undefined, 0]

  const shichu = calcShichu(year, month, day, birthHour, birthMinute)
  const nayin = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
  const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays)
  const expanded = calcExpandedDivination(shichu)
  const sukuyo = getSukuyo(year, month, day)
  const honmei = calcHonmeiStar(year, month, day)
  const kyuseiProfile = calcKyuseiProfile(year, month, day, birthHour, birthMinute)

  return {
    birthDate: fixture.birthDate,
    birthTime: fixture.birthTime ?? undefined,
    birthplace: fixture.birthplace,
    gender: fixture.gender,
    age: calcAge(fixture.birthDate, today),
    shichuDay: shichu.day.kanshi,
    nayin,
    sanmeiStar: sanmei.shukumeiStar,
    chusatsu: sanmei.chusatsu,
    sukuyo,
    lifePathNumber: calcLifePathNumber(fixture.birthDate),
    numerologyProfile: calcNumerologyProfile(year, month, day),
    honmeiName: KYUSEI_NAMES[honmei],
    kyuseiProfile,
    timing: calcTimingCycles(year, month, day, birthHour, birthMinute, fixture.gender),
    sanmeiRelations: calcSanmeiRelations(shichu, sanmei.chusatsu),
    ziwei: calcZiwei(year, month, day, birthHour, fixture.gender, fixture.birthplace),
    astrology: calcAstrology(year, month, day, birthHour, birthMinute, fixture.birthplace),
    ...expanded,
  } as ReportInput
}
