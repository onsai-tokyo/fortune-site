/**
 * Display copy for the existing legacy calculator's themes / relationshipEvents.
 * Each entry keeps one specific source meaning. No scoring, year selection, monthly
 * inference, personal history or generic default belongs in this renderer.
 */
export interface AnnualPhrase { id: string; title: string; body: string }

const COPY: Record<string, AnnualPhrase> = {
  '自分の基準を立て直し、主体的に進めること': {
    id: 'self-direction', title: '自分で判断する基準を整え直す年',
    body: '何を大切にして進むかを自分で決め、周囲任せにしていた判断を引き受けることがテーマです。',
  },
  '仲間との役割を組み替え、活動範囲を広げること': {
    id: 'shared-roles', title: '仲間との役割分担を見直し、活動を広げる年',
    body: '一緒に動く人との分担を見直し、自分が関わる範囲を広げることがテーマです。',
  },
  '楽しみや得意なことを、無理なく外へ表すこと': {
    id: 'expression', title: '好きなことや得意なことを外へ届ける年',
    body: '楽しめることや得意なことを、負担の少ない形で人に伝えていくことがテーマです。',
  },
  '違和感を言葉にし、表現や方法を磨き直すこと': {
    id: 'refinement', title: '感じていた違和感を言葉にして、方法を磨く年',
    body: 'しっくりこない部分を言葉にして、伝え方や進め方を練り直すことがテーマです。',
  },
  '人との接点を広げ、機会や成果を動かすこと': {
    id: 'connections', title: '人とのつながりから機会を広げる年',
    body: '関わる人を増やし、そのつながりを新しい機会や成果へ結びつけることがテーマです。',
  },
  '収入と暮らしの基準を整え、継続できる形にすること': {
    id: 'sustainable-living', title: '収入と生活を、続けられる形に整える年',
    body: '日々の暮らしと収入の釣り合いを確かめ、無理なく続けられる基準を作ることがテーマです。',
  },
  '変化へすばやく対応し、難しい役割へ踏み出すこと': {
    id: 'respond-to-change', title: '変化に応じながら、難しい役目へ踏み出す年',
    body: '状況の変化に素早く応じ、これまでより難しい役目に取り組むことがテーマです。',
  },
  '責任や肩書を引き受け、関係や役割を正式にすること': {
    id: 'formal-responsibility', title: '責任を引き受け、曖昧だった役割を正式にする年',
    body: '肩書や責任を受け持ち、人との関わり方や自分の役割をはっきりさせることがテーマです。',
  },
  '慣れた見方を離れ、専門性や新しい方法を試すこと': {
    id: 'new-methods', title: 'いつもの見方を離れ、新しい方法を試す年',
    body: '慣れ親しんだ考え方から一歩離れ、専門分野を深めたり、別の方法を試したりすることがテーマです。',
  },
  '学びや支援を受け取り、次の土台を固めること': {
    id: 'learning-support', title: '学びと周囲の支えを、次の土台にする年',
    body: '人から教わることや助けてもらうことを受け取り、次へ進む準備を整えることがテーマです。',
  },
  '縁がまとまること': {
    id: 'ties-settle', title: '人とのつながりが、ひとつの形にまとまる年',
    body: '続いてきたつながりを、具体的な形へまとめていくことにも目が向く時期です。',
  },
  '移動や配置転換で関係を組み替えること': {
    id: 'environment-change', title: '場所や担当の変化から、関わり方を見直す年',
    body: '居場所や担当が変わることを通じて、人との関わり方を組み直すことにも目が向く時期です。',
  },
  '隠れていたずれや前提を見直すこと': {
    id: 'review-assumptions', title: '見過ごしていた食い違いを確かめ直す年',
    body: '表に出ていなかった食い違いや、当たり前だと思っていた前提を見つめ直すこともテーマになります。',
  },
  '出会いや接触が増えやすい': {
    id: 'new-encounters', title: '新しい人と知り合う機会が広がる年',
    body: '新しい人との出会いや、人と交流する機会が広がりやすい時期です。',
  },
  '隠れていたずれや前提が表面化しやすい': {
    id: 'hidden-misalignment', title: '表に出ていなかった食い違いに気づく年',
    body: 'これまで見えていなかった食い違いが表に出て、関係の前提を確かめ直す場面が生まれやすい時期です。',
  },
  '交際開始・別離・復縁など関係の状態が切り替わりやすい': {
    id: 'relationship-transition', title: '近い人との関係が切り替わりやすい年',
    body: '付き合い始める、離れる、よりを戻すなど、近い人との関わり方が変わる節目に目が向く時期です。',
  },
  '関係や生活環境を組み替えやすい': {
    id: 'relationship-restructure', title: '暮らしと人との関わり方を組み直す年',
    body: '生活の場や人との付き合い方を、今の状況に合う形へ整え直しやすい時期です。',
  },
  '交際・同居・婚約・結婚、または関係の見直しなど節目を定めやすい': {
    id: 'relationship-definition-review', title: '関係を進めることと、見直すことの節目が重なる年',
    body: '付き合い方や一緒に暮らすこと、将来の約束を具体的にする一方、関わり方そのものを考え直す節目にも目が向く時期です。',
  },
  '交際・同居・婚約・結婚、または正式な終了など関係を定めやすい': {
    id: 'relationship-definition', title: 'これからの関係を、はっきりした形にする年',
    body: '付き合うことや一緒に暮らすこと、将来の約束を具体的にする節目に目が向く時期です。続けるだけでなく、関係に区切りをつける方向も含みます。',
  },
  '関係の定義や将来を現実的に決めやすい': {
    id: 'relationship-decisions', title: '人との関係や将来について、具体的に決める年',
    body: 'これからどのように関わっていくかを、日々の生活も踏まえて具体的に決めやすい時期です。',
  },
}

export function annualNarrative(values: string[]): AnnualPhrase[] {
  const seen = new Set<string>()
  return values.flatMap(value => {
    const source = value.trim()
    const phrase = Object.hasOwn(COPY, source) ? COPY[source] : undefined
    if (!phrase || seen.has(phrase.id)) return []
    seen.add(phrase.id)
    return [phrase]
  })
}
