import { TEN_GOD_COPY, STAGE_COPY } from './series-guide-copy.js'

const dateTime = iso => iso.slice(0, 16).replace('T', ' ').replaceAll('-', '/')
const calendarNote = data => `<p>この記事の一年は、${dateTime(data.startAt)}の立春から、${dateTime(data.endAt)}の立春直前までです。日時はすべて日本時間で、時刻は分までの目安として表示しています。${data.year}年1月から立春前までは、前年の年柱で読みます。</p><p>月は節入りから次の節入り直前までで区切ります。暦の1日から月末までとは異なります。各月の開始日時を目安に、その期間の月運を読んでください。</p>`

// Interpretive advice is keyed by the engine's ten-god/stage pair, never a prediction.
const GOD = {
  比肩: { title: '自分の軸を確かめる年', month: '自分で決めることを一つ選び、周囲に伝えてみましょう。', love: 'お互いの予定や、一人で過ごす時間を確かめましょう。希望を話すときは、相手の希望も同じように聞いてください。', work: '自分で判断する範囲と、相談が必要な範囲を整理しましょう。任された仕事は、小さな区切りを決めて進めると振り返れます。' },
  劫財: { title: '協力と競争を見直す年', month: '誰と何を分担するかを決め、協力の形を整えましょう。', love: '友人との予定や費用の分担について、二人で確認しましょう。相手と競うより、それぞれが困っていることを聞いてみてください。', work: '仲間と目標を共有し、担当と期限を言葉にしましょう。意見が違うときは、勝ち負けより必要な条件を確かめます。' },
  食神: { title: '楽しみと表現を育てる年', month: '楽しみながら続けられる工夫を、日々の予定に入れてみましょう。', love: '二人で気楽に楽しめる時間を用意しましょう。相手の返事や距離感を見ながら、無理のない誘い方を考えてください。', work: '得意なことを、続けやすい手順に整えましょう。作ったものへの感想を聞き、次に生かすと振り返りができます。' },
  傷官: { title: '表現と改善を磨く年', month: '気づいた改善点は、理由と代わりの案を添えて伝えましょう。', love: '言いたいことを整理し、相手が受け止めやすい順に話しましょう。指摘するときは、どうしてほしいかも具体的に伝えてください。', work: '気になる点を直す前に、目的と影響する範囲を確認しましょう。改善案を小さく試し、結果を見て続けるかを決めます。' },
  偏財: { title: '人との交流を広げる年', month: '人に会う予定と使える予算を、先に確かめておきましょう。', love: '会話を増やすときは、相手が話したいことにも耳を傾けましょう。新しい出会いでは、急いで関係を決めず、約束を守れるかを見ます。', work: '新しい話には、予算・納期・担当を確認してから返事をしましょう。広げた人脈は、次の連絡やお礼まで含めて大切にします。' },
  正財: { title: '日々の積み重ねを大切にする年', month: '小さな約束や作業を、無理なく続けられる形に整えましょう。', love: '会う予定や生活の負担など、日々の約束を丁寧に確かめましょう。結婚を考える二人なら、お金や住まいの希望を話す材料にできます。', work: '毎日の作業を見直し、続ける量と優先順位を決めましょう。収支や進み具合を記録し、必要なときに計画を修正します。' },
  偏官: { title: '行動とペース配分を考える年', month: '急ぐことを絞り、期限と休む時間を一緒に決めましょう。', love: '早く答えがほしいときほど、相手の都合や意思を確認しましょう。自分の希望を伝えた後は、返事を待つ余地も残してください。', work: '取り組む課題を絞り、急ぐものと待てるものを分けましょう。判断に迷う場面は、一人で抱えず担当者へ相談します。' },
  正官: { title: '責任と信頼を見直す年', month: '役割や約束を確かめ、無理なく守れる形に整えましょう。', love: '関係の呼び方だけでなく、約束や生活上の行動を見ましょう。将来の話では、二人が引き受けられることを具体的に確認します。', work: '求められる役割と、判断できる範囲を確認しましょう。手順や相談先を記録し、責任が一人に偏らないようにします。' },
  偏印: { title: 'ひらめきと学びを試す年', month: '気になる学びを小さく試し、続けるか見直す日を決めましょう。', love: '新しい興味や、一人で考えたい時間を相手にも伝えましょう。違う考え方に出会ったら、すぐに結論を出さずに理由を聞いてください。', work: '新しい方法を試すときは、期間と範囲を限定しましょう。ひらめいた案を記録し、実際に使える条件を確かめます。' },
  正印: { title: '知識と支えを受け継ぐ年', month: '学んだことを整理し、相談したい相手に質問をまとめましょう。', love: '相手の困りごとを聞き、自分も頼りたいことを言葉にしましょう。支える側だけに回らず、引き受けられる範囲も伝えてください。', work: '知識を学ぶ時間と、実際に使う機会を用意しましょう。助言はそのまま受け取るだけでなく、今の仕事に合うかを確かめます。' },
}
const STAGE_ACTION = {
  長生: '初めてのことは、教わりながら一歩ずつ進めると振り返れます。',
  沐浴: '気になる案を試すときは、戻せる範囲を決めておきましょう。',
  冠帯: '人前に出す前に、見せ方と準備することを確かめましょう。',
  建禄: '日々の手順を整え、自分で続けられる量を確かめましょう。',
  帝旺: '大きく動く前に、周囲への影響と分担を確認しましょう。',
  衰: 'これまでの経験を使い、優先することを絞ってみましょう。',
  病: '気づきや考えを記録し、考える時間を用意してみましょう。',
  死: '取り組む対象を一つ選び、集中する時間を区切りましょう。',
  墓: '集めた情報や道具を整理し、必要なものを選びましょう。',
  絶: '続ける理由が薄れた習慣は、小さく見直してみましょう。',
  胎: 'まだ形にならない案は、試すための準備から始めましょう。',
  養: '助けてもらえることを確認し、無理のない土台を整えましょう。',
}

export function monthlyFocus(tenGod, twelveStage) {
  if (!GOD[tenGod] || !STAGE_ACTION[twelveStage]) throw new Error('Unknown fortune interpretation')
  return GOD[tenGod].month + STAGE_ACTION[twelveStage]
}

export function fortunePages(data, { stemSlugs, godSlugs, stageSlugs, inlineCta }) {
  if (data.months.length !== 12 || data.stems.length !== 10) throw new Error('Incomplete annual data')
  const year = data.year, root = `guides/${year}-fortune`
  const published = `${year - 1}-12-01`
  const links = data.stems.map(item => `<tr><th><a href="/${root}/${item.slug}">${item.stem}の人の${year}年</a></th><td>${item.annual.tenGod}</td><td>${item.annual.twelveStage}</td></tr>`).join('')
  const hub = {
    path: root, published, updated: published,
    title: `${year}年の運勢を四柱推命で読む｜日干10タイプ別の年運と月運`,
    description: `${year}年の年柱は${data.yearPillar}。自分の日干を調べ、10タイプ別に通変星・十二運と節入りで区切る12か月を確認できます。恋愛や仕事の過ごし方も紹介します。`,
    body: `<p><strong>${year}年の運勢は、自分の日干と年柱「${data.yearPillar}」の関係から読みます。</strong>日干は、生まれた日の干支の先頭にある一文字です。下の10タイプから、自分の日干を選んでください。</p><h2>${year}年の年柱「${data.yearPillar}」とは</h2><p>年柱は、その年の干支を天干と地支の二文字で表したものです。${year}年は、天干が「${data.yearPillar[0]}」、地支が「${data.yearPillar[1]}」になります。自分の日干と比べて、通変星と十二運を読みます。</p><p>通変星は日干と天干の関係を表す星です。十二運は日干と地支の関係を、十二の段階で表します。同じ年でも、日干によって確認する星や段階が変わります。</p>${calendarNote(data)}<h2>自分の日干を調べる</h2><p><a href="/tools/day-master">生年月日から自分の日干を無料で調べる</a>と、甲・乙・丙・丁・戊・己・庚・辛・壬・癸のどれかが分かります。意味を確認したい場合は、<a href="/guides/day-master">日干の解説</a>も読めます。</p><h2>日干10タイプ別の${year}年の運勢</h2><div class="table-scroll"><table><thead><tr><th>日干</th><th>年の通変星</th><th>年の十二運</th></tr></thead><tbody>${links}</tbody></table></div><h2>自分の一年を詳しく読むには</h2><p>日干だけの年運は、過ごし方を考える入口です。生まれた季節や命式全体、大運も合わせると、同じ日干でも確認する点が変わります。</p>${inlineCta('生年月日から性格や年ごとの流れを確認できます。', '/welcome', '生年月日から個人鑑定を読む')}`,
  }
  const members = data.stems.map(item => {
    if (stemSlugs[item.stem] !== item.slug) throw new Error('Day stem slug mismatch')
    const { tenGod, twelveStage } = item.annual, god = TEN_GOD_COPY[tenGod], stage = STAGE_COPY[twelveStage]
    const rows = data.months.map((month, i) => {
      const value = item.months[i]
      return `<h3>${month.calendarYear}年${month.calendarMonth}月（${month.term}から）</h3><p>${dateTime(month.startAt)}から、${dateTime(month.endAt)}直前までの期間です。</p><p>月柱は${month.pillar}。通変星は<a href="/guides/ten-god/${godSlugs[value.tenGod]}">${value.tenGod}</a>、十二運は<a href="/guides/twelve-stage/${stageSlugs[value.twelveStage]}">${value.twelveStage}</a>です。</p><p>${monthlyFocus(value.tenGod, value.twelveStage)}</p>`
    }).join('')
    return {
      path: `${root}/${item.slug}`, published, updated: published,
      title: `${year}年の運勢｜日干が${item.stem}の人は${GOD[tenGod].title}（四柱推命）`,
      description: `${year}年の日干${item.stem}の年運は、通変星「${tenGod}」と十二運「${twelveStage}」から読みます。節入りで区切る12か月の月運と、恋愛・仕事で大事にしたいことを紹介します。`,
      body: `<p><strong>日干が「${item.stem}」の人の${year}年は、${GOD[tenGod].title}として読みます。</strong>${tenGod}（${god.reading}）は、${god.keyword}を表す通変星です。十二運は、日干と地支の関係を十二の段階で表したものです。</p><p>日干は、生まれた日の干支の先頭にある一文字です。自分の日干は<a href="/tools/day-master">生年月日から無料で調べられます</a>。普段の傾向を知りたい人は、<a href="/guides/day-master/${item.slug}">日干「${item.stem}」の性格・仕事・恋愛の解説</a>を先に確認できます。</p><h2>${year}年の${item.stem}は「${tenGod}・${twelveStage}」</h2><p>年柱「${data.yearPillar}」の天干「${data.yearPillar[0]}」を日干「${item.stem}」から見ると、<a href="/guides/ten-god/${godSlugs[tenGod]}">${tenGod}</a>になります。${god.lead}</p><p>年柱の地支「${data.yearPillar[1]}」に対する十二運は、<a href="/guides/twelve-stage/${stageSlugs[twelveStage]}">${twelveStage}</a>です。「${stage.keyword}」を、日々の行動を見直す手がかりにします。病・死・墓・絶という名前は、健康や寿命を予告するものではありません。</p><h2>年運・月運の期間</h2>${calendarNote(data)}<h2>${year}年の月ごとの注目点</h2><p>月の通変星と十二運を合わせて、試してみたい行動をまとめました。起こる出来事や相手の気持ちを断定するものではありません。</p>${rows}<h2>恋愛で大事にしたいこと</h2><p>${GOD[tenGod].love}</p><h2>仕事で大事にしたいこと</h2><p>${GOD[tenGod].work}</p><h2>自分の命式と合わせて読む</h2><p>生まれた季節や命式全体、長い流れを表す大運も一緒に確かめます。相手の言葉や生活の条件も確認し、自分が取れる行動を考える材料にしてください。</p><p><a href="/${root}">${year}年の運勢・日干10タイプの一覧へ戻る</a></p>${inlineCta('自分の生年月日から、性格と年ごとの流れを読めます。', '/welcome', '生年月日から個人鑑定を読む')}`,
    }
  })
  return { year, root, pages: [hub, ...members], label: `${year}年の運勢` }
}
