// 画面確認用の仮データ。文章はすべてサンプル。
import { mockProfile, mockPersonaTitle, mockChapters, mockYears, mockPartners, mockCoupleYears, mockBooks, mockFailedBook, initialSavedIds, chapterSections } from './demoData'
export { mockProfile, mockPersonaTitle, mockChapters, mockYears, mockPartners, mockCoupleYears, mockBooks, mockFailedBook, initialSavedIds, chapterSections }
import type { BookTheme, Partner, Plan, Relation, RelationGroup } from './types'











/** iOS PartnerProfilesView と同じ並び・同じ文言 */
export const relationOptions: Relation[] = ['片思い', 'お付き合い中', '婚約中', '夫婦', '復縁希望', '元恋人', '友人', '親友', '会社の同僚', '上司', '部下', '取引先', '親', '子', '兄弟姉妹', '配偶者の家族', 'その他']
export function relationGroup(label: Relation): RelationGroup {
  if (['片思い', 'お付き合い中', '婚約中', '夫婦', '復縁希望', '元恋人'].includes(label)) return 'romantic'
  if (['親', '子', '兄弟姉妹', '配偶者の家族'].includes(label)) return 'family'
  return 'friend'
}



/** サーバー lib/aiBooks.ts の BOOK_THEMES と同じ。iOSの初期値は「恋愛・関係」 */
export const bookThemes: BookTheme[] = ['恋愛・関係', '仕事', '人間関係', '時期の判断', 'その他']

/** サーバーと同じく、前後の空白を除いた「文字（コードポイント）」で数える。絵文字も1文字 */
export function countChars(text: string) { return [...text.trim()].length }

/**
 * サーバー validateBookQuestion と同じ判定を先に画面で行う（送信してから断られないように）。
 * 最終判断は必ずサーバー側。文言もサーバーと同じ。
 */
export function bookQuestionProblem(question: string): string | null {
  const q = question.normalize('NFKC')
  if (/自殺|自傷|死にたい|消えたい|命を絶|生きていたくない/.test(q))
    return 'この内容は鑑定書では扱えません。今すぐ危険がある場合は119・110へ連絡し、身近な人や医療機関に相談してください。'
  if (/寿命|余命|死ぬ|亡くなる|妊娠|不妊|病気|診断|癌|がん|服薬|薬を|治療|訴訟|裁判|法律判断|投資|株価|銘柄|殺す|傷つける方法|監視|ストーキング/.test(q))
    return '健康・妊娠・生死、法律や投資の判断、他者への加害や監視は扱えません。気持ちの整理や人との接し方について相談してください。'
  return null
}

/** iOS OnboardingView.prefectures / サーバー birthContext.ts と同じ47都道府県（それ以外は時差計算ができない） */
export const prefectures = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']





export { savedKey, savedCatalog } from './readingData'

/** 「一冊つくる」のもとにする読みものの初期値。相手がいればふたりの今年、いなければあなたの今年 */
export function defaultDraftSource(partner: Partner | undefined, year = 2026) {
  const couple = partner && (mockCoupleYears.find(y => y.year === year) ?? mockCoupleYears[mockCoupleYears.length - 1])
  if (partner && couple) {
    return { sourceTitle: `${partner.name}との${couple.year}年`, sourceSub: couple.title, sourceHref: `/couple/${partner.id}?year=${couple.year}`, theme: (relationGroup(partner.relation) === 'romantic' ? '恋愛・関係' : '人間関係') as BookTheme }
  }
  const self = mockYears.find(y => y.year === year) ?? mockYears[0]
  return { sourceTitle: `あなたの${self.year}年`, sourceSub: self.title, sourceHref: `/you/years/${self.year}`, theme: '時期の判断' as BookTheme }
}





export const plans: Plan[] = [
  { id: 'single', name: '1冊', credits: 1, price: 500, detail: 'ひとつの相談に、一冊の答え', recommended: false },
  { id: 'pack5', name: '5冊セット', credits: 5, price: 1980, detail: '1冊あたり396円。1冊ずつより約2割お得', recommended: true },
]

/** 相談のブック1冊につき、そのブックへ質問できる回数（無料の質問はなし） */
export const QUESTIONS_PER_BOOK = 2
