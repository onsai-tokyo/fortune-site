import type { TimingScoreKey } from '../lib/report/timingClaim.js'

/** Editorial hypotheses only. Matching these does not establish predictive accuracy. */
export interface StudyPattern {
  id: string
  themes: readonly TimingScoreKey[]
  title: string
  body: string
}

/** One calculated theme is sufficient; these are never used without evidence. */
export const SINGLE_THEME_COPY: Readonly<Record<TimingScoreKey, { title: string; body: string }>> = {
  relationship_activation: { title: '人との接点から、関係が動き始める', body: '新しく知り合うことや、知っている相手との交流を増やすことに目が向く時期として読めます。会話や一緒に過ごす時間を通して、今の自分が心地よいと感じる関わり方を探していくテーマです。' },
  relationship_binding: { title: '続けていきたい関係の形を考える', body: '人とのつながりを一時的なものにせず、続けられる形にするテーマです。会う頻度や約束、互いに担うことを具体的にする読みで、交際・結婚が決まることだけを意味しません。' },
  relationship_disruption: { title: '近い人との距離や付き合い方を見直す', body: 'これまで自然に続けてきた関わり方を、そのままでよいか確かめるテーマです。距離を置く方向も、続けるために付き合い方を変える方向も含みます。別れが起こると決めつけず、自分の負担や希望を言葉にして考えられます。' },
  relationship_secrecy: { title: '分からないことを、推測のままにしない', body: '関係の中で見えていない事情や、言葉にしていない前提を確かめるテーマです。気になることがあれば、確認できた事実と自分の想像を分けて整理してみてください。この示唆から相手の嘘や浮気を認定することはできません。' },
  relationship_idealization: { title: '相手への期待と、実際の関わりを見比べる', body: '相手に望んでいることや、こうなってほしいという気持ちを見つめるテーマです。実際に交わした言葉や行動と期待を分けて考えると、自分が大切にしたい関係の形を確かめやすくなります。' },
  marriage_legalization: { title: '将来の約束を、具体的な形にする', body: '関係をはっきりした約束や、公の形へ進めることがテーマとして出ています。婚約・入籍だけでなく、これからどう関わるかを正式に話し合う読みです。気持ちに加えて、暮らしや役割の条件も確かめることが手がかりになります。' },
  career_activation: { title: '仕事に参加し、自分の役目を見つける', body: '仕事に取り組むことや、新しい役目を持つことに関わる示唆があります。任される内容に触れながら、どんな場面で力を使えるかを確かめる読みです。就職だけでなく、今の仕事への取り組み方にも重ねて考えられます。' },
  career_change: { title: '働く場所や、担う役割を選び直す', body: '働く環境や担当の変化を考えるテーマです。転職・部署異動・担当替えなど複数の形を含みます。今の場所で変えられることと、環境を変えて試したいことを分けると、自分に必要な変化が見えてきます。' },
  career_expansion: { title: '仕事で関われる範囲を広げる', body: '扱う仕事や、周囲と協力して動かす範囲を広げることがテーマです。経験を生かして次の役目に取り組む一方、何を人に任せるかも考える読みになります。役職や評価の上昇を確約するものではありません。' },
  money_status: { title: '収入や待遇と、働く条件を見直す', body: '収入・待遇・お金の使い方を具体的に考えるテーマです。増えるか減るかを断定する読みではなく、日々の負担や望む暮らしに対して、今の条件が釣り合っているかを確かめる手がかりになります。' },
  home_family: { title: '住まいと、身近な人との暮らしを整える', body: '落ち着いて過ごす場所や、家族・身近な人との生活に目が向くテーマです。住まいそのものだけでなく、日々の分担や一緒に過ごす時間を、今の状況に合う形へ整える読みができます。' },
  relocation: { title: '過ごす場所が変わる可能性を考える', body: '通う場所や暮らす場所、活動する範囲を見直すテーマです。引越しだけでなく、通勤や通学、普段行く場所の変更も含めて読めます。場所が変わると日々の過ごし方がどう変わるかを考えてみてください。' },
  education_activation: { title: '学ぶことを、次の経験につなげる', body: '知識や技能を身につけ、新しい理解を得ることに関わる示唆があります。学校・資格だけでなく、人に教わることや自分で試すことも含むテーマです。覚えたことをどこで使ってみたいかまで考える読みができます。' },
  education_disruption: { title: '学びの計画や、進み方を組み直す', body: '進路や勉強の進め方を、今の条件に合わせて調整するテーマです。目標を続けることと、方法を変えることを分けて考えられます。不合格や挫折を断定するものではなく、つまずきがあれば準備や時間配分を見直す手がかりになります。' },
  identity_reset: { title: '自分が大切にすることを選び直す', body: 'これまでの役割や周囲の期待を一度見渡し、自分は何を続けたいかを考えるテーマです。大きな環境変化がなくても、時間の使い方や引き受ける範囲を変える形で読めます。' },
  social_network_change: { title: '付き合う人や、協力の仕方が変わる', body: '日常的に関わる人や、相談できる相手とのつながりを見直すテーマです。新しい輪に入ることも、既存の関係の役割を変えることも含みます。人数を増やすことより、どんな関わりを育てたいかを考える読みです。' },
  responsibility: { title: '引き受ける責任を、無理のない形にする', body: '任されることや、約束として担うことを具体的にするテーマです。責任があることと、一人で全てを抱えることは分けて考えられます。判断できる範囲と助けを求められる範囲を確かめる読みです。' },
  emotional_stress: { title: '気持ちの負担に気づき、余白を作る', body: '気を張っていることや、気持ちに負担をかけていることへ目を向けるテーマです。抱えていることを整理し、休む時間や相談できる相手を確かめる読みになります。心の病気や、出来事の深刻さを判定するものではありません。' },
}

export const MULTI_SYSTEM_PATTERNS: readonly StudyPattern[] = [
  { id: 'study-setback', themes: ['education_disruption', 'emotional_stress'], title: '学びの壁と、気持ちの立て直し', body: '学びや進路を見直すテーマと、気持ちの負担に関するテーマが重なります。計画を続ける部分と、方法を変える部分を分けて考える読みです。受験の不合格そのものを示すわけではありません。' },
  { id: 'study-work', themes: ['education_activation', 'career_activation'], title: '働く経験と学びを行き来する', body: '学びを深めることと、仕事に取り組むことの両方に根拠があります。実際に試して分かった課題を学びへ持ち帰るように、二つの活動のつながりを考える読みです。' },
  { id: 'study-move-encounter', themes: ['education_activation', 'relocation', 'relationship_activation'], title: '学ぶ場所・暮らす場所・出会う人が広がる', body: '学び、場所の変化、人との接点という三つのテーマが出ています。新しい場へ参加することが、日常の過ごし方と関わる相手の両方に影響する可能性を考えます。進学や初めての交際の成立までは特定しません。' },
  { id: 'work-encounter', themes: ['career_activation', 'relationship_activation'], title: '仕事への参加と、人との接点が重なる', body: '仕事を通して役目を持つことと、人との関わりが動くことを合わせて読む候補です。協力して働く関係と私的な関係を混同せず、どちらの接点が広がっているかを確かめます。' },
  { id: 'work-break', themes: ['career_change', 'relationship_disruption'], title: '働き方と、近い人との関係を組み直す', body: '働く環境や役割の変更と、近い関係の調整が並ぶ候補です。所属や時間の使い方が変わる中で、続けたい関係をどう保つかを考えます。転職と別れが必ず同時に起きるという読みではありません。' },
  { id: 'relationship-hurt', themes: ['relationship_disruption', 'emotional_stress'], title: '関係の揺らぎを受け止め、気持ちを整える', body: '関係の変化と感情的な負担を一緒に扱う読みです。相手との距離を変えることと、自分の気持ちが落ち着くことは別の過程として考えられます。破局の事実や苦しさの程度を断定しません。' },
  { id: 'relationship-expectations', themes: ['relationship_disruption', 'relationship_idealization'], title: '思い描いた関係と、現実の関わり方を確かめる', body: '関係の調整と、相手に重ねていた期待を確かめるテーマが重なります。知っている事実と願っていることを分け、今の関係を捉え直す読みです。過去の交際回数や「本当の失恋」は推定しません。' },
  { id: 'encounter-after-adjustment', themes: ['relationship_disruption', 'relationship_activation'], title: '関係の見直しと、新しい接点が並ぶ', body: '近い関係を調整することと、人との接点が広がることの両方に対応があります。同じ相手との関わり直しか、別の相手との出会いか、またどちらが先かは、この年単位の根拠だけでは決まりません。' },
  { id: 'encounter-binding', themes: ['relationship_activation', 'relationship_binding'], title: '知り合うことから、続く関わりを考える', body: '人との接点と、関係を継続するための約束を合わせて考える読みです。新しい交際にも、既に知っている相手との関わりを深めることにも当てはめられ、再会だったと断定するものではありません。' },
  { id: 'binding-adjustment', themes: ['relationship_binding', 'relationship_disruption'], title: 'つながりを保つために、付き合い方を変える', body: '関係を続けようとするテーマと、今の形を見直すテーマが年内の候補にあります。続ける意思と無理のない条件を分けて話す読みです。復縁や別れの繰り返しを実績として数えません。' },
  { id: 'relationship-uncertainty', themes: ['relationship_secrecy', 'relationship_idealization', 'emotional_stress'], title: '分からない事情を推測せず、気持ちを守る', body: '関係の不透明さ、期待、気持ちの負担を扱う候補です。確認できたことと未確認のことを分け、判断を急がない読みになります。相手の浮気・既婚・嘘を出生情報から認定するものではありません。' },
  { id: 'career-growth', themes: ['career_expansion', 'responsibility'], title: '任される範囲と、引き受ける責任が広がる', body: '仕事の拡大と責任に対応する要素を合わせて読みます。肩書だけでなく、判断できる範囲や支援を受けられる範囲も考えるテーマです。昇進を確約するものではありません。' },
  { id: 'career-income', themes: ['career_expansion', 'money_status', 'responsibility'], title: '役割・評価・収入の条件を一緒に考える', body: '仕事の範囲、金銭面、責任が組み合わさる候補です。任される内容に対して報酬や働く条件が釣り合っているかを考えます。役員就任や具体的な年収はこの根拠から算出しません。' },
  { id: 'career-reset', themes: ['career_change', 'identity_reset'], title: '働き方を変え、自分の立ち位置を選び直す', body: '職務の変化と、自分の立ち位置を見直すことを合わせた読みです。転職だけでなく、同じ組織で担当や役割を変える方向も含め、今の自分が力を使いたい範囲を考えます。' },
  { id: 'role-and-network', themes: ['career_change', 'social_network_change'], title: '担当が変わり、関わる人も変わる', body: '仕事上の役割と、日々関わる人の変化が重なる候補です。相談相手や協力の仕方を作り直す読みであり、転職と社内異動のどちらかまでは決めません。' },
  { id: 'marriage-home', themes: ['marriage_legalization', 'home_family'], title: '関係の約束を、日々の暮らしへ落とし込む', body: '関係を公に定めることと、住まい・家族の条件を合わせて考える候補です。入籍を決めた事実を示すのではなく、住む場所や分担まで具体化するテーマとして読みます。' },
  { id: 'marriage-responsibility', themes: ['marriage_legalization', 'responsibility'], title: '将来の約束と、それに伴う責任を考える', body: '関係を正式な形にするテーマと責任のテーマが出ています。約束の言葉だけでなく、互いに引き受けられることを具体的に考える読みです。婚約・入籍の時期を区別するには追加の根拠が必要です。' },
  { id: 'relationship-work-focus', themes: ['relationship_disruption', 'identity_reset', 'career_activation'], title: '関係との距離を見直し、仕事へ向ける力を考える', body: '関係の調整、自分の立ち位置、仕事への取り組みを一緒に読む候補です。何に時間を使いたいかを選び直すテーマで、恋愛を諦めた事実や出会いがないことを示すものではありません。' },
  { id: 'career-relationship-restart', themes: ['career_change', 'relationship_disruption', 'relationship_activation'], title: '働く環境と、人との関わり方の両方を変える', body: '仕事の変化、近い関係の調整、新しい接点が年内に出る候補です。生活全体の組み替えとして読めますが、同じ月に起きることや、別れの後に出会う順序は未判定です。' },
  { id: 'study-rebuild', themes: ['education_activation', 'education_disruption'], title: '学びを続けるために、進め方を変える', body: '学びを進めるテーマと、計画を調整するテーマの両方があります。挑戦をやめるかどうかではなく、方法や時間配分を見直す読みです。合格・不合格の判定は行いません。' },
]
