// 占術の概要記事（九星気学・宿曜・数秘術・紫微斗数・西洋/インド占星術）で使う実例を出力する。
// 実行: cd backend && npx tsx ../frontend/scripts/article-data/overview-samples.ts
import { calcHonmeiStar, calcKyuseiProfile, getSukuyo, calcLifePathNumber, calcNumerologyProfile } from '../../../backend/src/lib/divination/index.ts'
import { calcZiwei } from '../../../backend/src/lib/ziwei.ts'
import { calcAstrology } from '../../../backend/src/lib/astrology.ts'

const [y, m, d, h, min] = [1995, 2, 20, 5, 40]
const short = (value: unknown) => JSON.stringify(value).slice(0, 1500)
console.log('九星・本命星', short(calcHonmeiStar(y, m, d)))
console.log('九星・詳細', short(calcKyuseiProfile(y, m, d, h, min)))
console.log('宿曜', short(getSukuyo(y, m, d)))
console.log('ライフパス', calcLifePathNumber('1995-02-20'), short(calcNumerologyProfile(y, m, d)))
console.log('紫微斗数', short(calcZiwei(y, m, d, h, 'female', '東京都')))
console.log('占星術', short(calcAstrology(y, m, d, h, min, '東京都')))
