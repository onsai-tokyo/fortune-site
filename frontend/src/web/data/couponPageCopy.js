const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const paragraph = text => `<p class="m-0 text-sm leading-[1.85] text-fl-body">${text}</p>`
const heading = text => `<h2 class="m-0 text-xl font-medium leading-relaxed">${text}</h2>`
const question = text => `<h3 class="m-0 text-base font-medium">${text}</h3>`

function dateValue(value) {
  if (value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid coupon checkedAt')
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid coupon checkedAt')
  return date.getTime()
}

export function checkedAtLabel(value) {
  return dateValue(value) === null ? '確認中' : value
}

export function couponCheckSummary(offers) {
  const dates = offers.map(offer => offer.checkedAt).filter(value => dateValue(value) !== null).sort()
  return { count: offers.length, latest: dates.at(-1) ?? '', unchecked: offers.length - dates.length }
}

export function warnStaleCouponChecks(offers, { today, warn = console.warn }) {
  const now = dateValue(today)
  if (now === null) throw new Error('Coupon check requires a reference date')
  for (const offer of offers) {
    const checked = dateValue(offer.checkedAt)
    if (checked === null) continue
    const days = Math.floor((now - checked) / 86400000)
    if (days < 0) throw new Error(`Future coupon checkedAt: ${offer.id}`)
    if (days >= 90) warn(`Coupon confirmation is 90+ days old: ${offer.id} (${offer.checkedAt}, ${days} days)`)
  }
}

export function couponPageMetadata(offers) {
  const { count, latest, unchecked } = couponCheckSummary(offers)
  const confirmation = latest
    ? `最終確認日：${latest}。${unchecked ? `確認日未記録${unchecked}件。` : ''}`
    : '公式内容の最終確認日は確認中です。'
  return {
    title: `占いクーポン・初回特典の比較｜電話占い・チャット占い${count}サービス`,
    description: `電話占い・チャット占い${count}サービスの初回特典を、対象者・条件・期限で比較。${confirmation}広告を含みます。`,
    heading: '占いクーポン・初回特典',
  }
}

export function couponComparisonHtml(offers, relatedLinks = []) {
  const { count, latest, unchecked } = couponCheckSummary(offers)
  const th = text => `<th class="border border-fl-line bg-fl-surface p-2 font-medium" scope="col">${escape(text)}</th>`
  const td = text => `<td class="border border-fl-line p-2 align-top">${escape(text)}</td>`
  const rows = offers.map(offer => `<tr data-offer-id="${escape(offer.id)}"><th class="border border-fl-line bg-fl-surface p-2 font-medium" scope="row">${escape(offer.name)}</th>${td(offer.channel === 'phone' ? '電話' : 'チャット')}${td([offer.prefix, offer.amount, offer.unit].filter(Boolean).join(' '))}${td(offer.facts.target)}<td class="border border-fl-line p-2 align-top">${[offer.facts.terms, offer.example].filter(Boolean).map(text => paragraph(escape(text))).join('')}</td>${td(offer.facts.validity)}${td(checkedAtLabel(offer.checkedAt))}<td class="border border-fl-line p-2 align-top"><a href="${escape(offer.officialDetailsUrl)}" target="_blank" rel="noopener noreferrer" class="underline">公式の条件を見る</a></td></tr>`).join('')
  const first = offers[0]
  const confirmation = `最終確認日：${escape(checkedAtLabel(latest))}。${unchecked ? `確認日の記録がない特典は${unchecked}件あり、「確認中」と表示しています。` : ''}`
  const links = relatedLinks.length ? heading('相談前に読めるページ') + `<ul>${relatedLinks.map(({ href, label }) => `<li><a href="${escape(href)}" class="underline">${escape(label)}</a></li>`).join('')}</ul>` : ''
  return [
    paragraph(`このページは広告を含みます。電話占い・チャット占い${count}サービスの初回特典を掲載しています。`),
    paragraph(confirmation),
    paragraph('チケット番号順に掲載しています。'),
    heading('電話占い・チャット占いの初回特典を比較'),
    '<div class="table-scroll overflow-x-auto"><table class="w-full min-w-max border-collapse text-left text-xs leading-relaxed"><thead><tr>' +
      ['サービス', '電話／チャット', '特典の内容', '対象者', '主な条件', '有効期限', '確認日', '公式ページ'].map(th).join('') + `</tr></thead><tbody>${rows}</tbody></table></div>`,
    heading('初回特典を使う前に確認すること'),
    '<ul class="m-0 list-disc pl-5 text-sm leading-[1.85] text-fl-body"><li>対象者：新規登録や初回鑑定など、どの利用条件が必要か。</li><li>併用条件：ほかのクーポンやポイントと一緒に使えるか。</li><li>期限：取得・申込み・利用に期限があるか。</li><li>費用：無料枠を超えたときに鑑定が終了するか、料金が発生するか。</li></ul>',
    heading('初回特典についてよくある質問'),
    question('初回特典は誰でも使えますか？'),
    paragraph('各サービスの「対象者」に記載された条件を満たす方が対象です。' + (first ? `${escape(first.name)}の対象者は「${escape(first.facts.target)}」です。` : '')),
    question('電話とチャットはどちらが安いですか？'),
    paragraph('特典には、金額・分数・ポイントなど異なる単位があります。対象者や条件も異なるため、この一覧だけでは料金の安さを判断できません。比較表の条件と、申込み先の料金案内を合わせて確認してください。'),
    question('特典の有効期限はどこで確認できますか？'),
    paragraph('比較表の「有効期限」を確認してください。掲載内容で期限が分からない場合は、公式案内やログイン後のクーポン画面で確認してください。'),
    question('確認日が「確認中」となっているのはなぜですか？'),
    paragraph('運営者が公式内容を確認した日の記録が未入力のためです。申込み前に、公式ページで現在の対象者・条件・期限を確認してください。'),
    links,
  ].join('')
}
