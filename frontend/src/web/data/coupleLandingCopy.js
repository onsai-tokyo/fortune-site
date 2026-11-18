import { coupleLandingExample } from './coupleLandingExample.js'

export const coupleSearchMetadata = {
  title: '相性占い 無料｜生年月日で二人の相性と年ごとの流れ',
  description: '二人の生年月日と出会った年から、一年ごとの関係のテーマと関わり方を無料で表示。恋人・片思いの相手・元恋人・夫婦・友人・家族との相性に使えます。会員登録と出生時刻は不要です。',
  heading: '生年月日で見る無料の相性占い',
}

// Enable together with the three published SEO-07 pages; shared by HTML and React.
export const coupleQuestionPagesPublished = true
export const coupleResultConsultation = 'この年表を手元に、二人のこれからを個別に相談することもできます。'

const heading = text => `<h2 class="m-0 text-xl font-medium leading-relaxed">${text}</h2>`
const paragraph = text => `<p class="m-0 text-sm leading-[1.85] text-fl-body">${text}</p>`
const question = text => `<h3 class="m-0 text-base font-medium">${text}</h3>`
const link = (href, text) => `<a href="${href}" class="underline">${text}</a>`
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

function timelineExample() {
  // Build-time engine quotation only; no visitor input or API result enters HTML.
  const th = (text, year = false) => `<th class="border border-fl-line bg-fl-surface p-2 font-medium${year ? ' whitespace-nowrap' : ''}">${escape(text)}</th>`
  const td = text => `<td class="border border-fl-line p-2 align-top">${escape(text)}</td>`
  const rows = coupleLandingExample.rows.map(row => `<tr>${th(`${row.year}年`, true)}${td([row.title, ...row.tags].join(' ／ '))}${td(row.excerpt)}</tr>`).join('')
  return heading('結果の例') + paragraph('これは、1995年2月20日生まれの女性と、1992年7月15日生まれの男性の例です。2021年に出会った恋人どうしとして、出生時刻を空欄にして計算しています。どちらも架空の人物です。') +
    paragraph(`${coupleLandingExample.referenceYear}年時点の計算例から、3年分の見出しと文章の一部を紹介します。`) +
    `<div class="overflow-x-auto"><table class="w-full border-collapse text-left text-xs leading-relaxed"><thead><tr>${['年', '年表に出る見出しと印', '鑑定文の一部'].map(text => th(text)).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` +
    paragraph('年表の印は、その年のテーマを読むための目印です。別れや結婚を決める判定ではありません。思い当たる年を開いて、実際の二人の状況と照らし合わせてください。')
}

export function coupleLandingHtml(published = coupleQuestionPagesPublished) {
  // Only compile-time editorial strings are used; never interpolate user or API data.
  return [
    paragraph('二人の生年月日と出会った年から、一年ごとの関係のテーマを無料で読みます。過去・今年・これからの流れを並べたものを、Fate Labでは「ふたりの年表」と呼んでいます。会員登録と出生時刻は不要です。入力には、二人の性別と関係、出会った年も必要です。'),
    heading('この相性占いでわかること・わからないこと'),
    paragraph('二人の関わり方の傾向と、年ごとのテーマを確認できます。同じ年の自分と相手の流れを見比べ、二人で向き合う課題が示される年を読みます。'),
    paragraph('相手の今の本心や、復縁・結婚が実現する時期を確定することはできません。相手の気持ちや希望は、本人の言葉と行動で確かめてください。'),
    timelineExample(),
    heading('悩み別の使い方'),
    paragraph(`${link('/guides/reconciliation-timing', '復縁したいとき')}は、別れた前後の年を振り返ります。連絡するかどうかは、別れ方や最後のやり取りも合わせて考えてください。`),
    paragraph(`${link('/guides/one-sided-love', '片思いの相手との関係')}は、知り合った年と今の年を見比べます。誘う前には、会話や誘いに相手がどう応じているかを確かめます。`),
    paragraph(`${link('/guides/partner-feelings', '連絡が減った相手の気持ち')}が気になるときは、連絡や会い方が変わった年を振り返ります。今の忙しさや、次に会う約束についても確認してください。`),
    paragraph(`${link('/guides/marriage-compatibility', '今の相手との結婚')}を考えるなら、年ごとのテーマを話し合いのきっかけにします。暮らし方・お金・家族との関わりは、二人で具体的に確かめてください。`),
    heading('よくある質問'),
    question('出会った年があいまいなときは？'),
    paragraph('出会った年の選択は必須です。年を選ばずに結果へ進むことはできません。学校や仕事の記録などを手がかりに、知り合った年を確かめてください。'),
    question('相手の生まれた年しかわからないときは？'),
    paragraph('相手の生年月日は、月日まで必要です。生まれた年だけでは、この相性占いは使えません。分からない月日を仮に埋めず、本人に確認してください。'),
    question('友人や家族とも使えますか？'),
    paragraph('友人・親友・親・子・兄弟姉妹などを、関係欄で選べます。恋人や夫婦以外でも、同じ入力の流れで年表を読めます。'),
    paragraph(`生年月日を使う考え方は、${link('/guides/compatibility', '相性占いの仕組みと結果の見方')}で解説しています。`),
    published ? heading('悩みに合わせて占う') + paragraph([
      link('/uranai/fukuen', '復縁占い'), link('/uranai/kataomoi', '片思い占い'), link('/uranai/aite-no-kimochi', '相手の気持ち占い'),
    ].join(' ／ ')) : '',
  ].join('')
}
