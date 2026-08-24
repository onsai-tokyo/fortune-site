import type { PairTraitScore } from './derivedTraitScores.js'
import type { CompatibilityProfileScore, MutualUnderstandingProfile, UnderstandingComponentKey } from './synastryFacts.js'

type ScoreBand = 'low' | 'middle' | 'high'

export interface CompatibilityScoreBlock {
  scoreKey: PairTraitScore['key'] | CompatibilityProfileScore['key'] | MutualUnderstandingProfile['key']
  band: ScoreBand
  text: string
  source: string
}

const understandingLabel: Record<UnderstandingComponentKey, string> = {
  cognitive: '考えの筋道',
  emotional: '感じていること',
  deep: 'まだ言葉にならない部分',
}

const conversationalFlowText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、互いの話を受け取り、次の話題へつなぎやすい二人です。ただし、話が弾むことと心の奥まで分かることは別に確かめてください。`,
  middle: cue => `${cue}では、話題によって会話の自然さが変わります。分かりやすい話だけでなく、答えにくい気持ちにも時間を取ってください。`,
  low: cue => `${cue}では、考えを組み立てる順序に差が出やすい二人です。返事の速さを理解の深さと決めず、言い直せる余白を作ってください。`,
}

const conversationalDepthText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、出来事の説明だけでなく、その奥にある怖さや願いまで言葉にしやすい二人です。ただし、深く話せることを同意と決めないでください。`,
  middle: cue => `${cue}では、自然に本音へ入れる話題と、入口で止まりやすい話題があります。答えを求めず聞く時間が、心の会話を育てます。`,
  low: cue => `${cue}では、会話が続いても心の奥を見せる時機に差が出やすい二人です。話題の多さで測らず、言葉を待てる余白を作ってください。`,
}

const humorCompatibilityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、意外な返しや話題の広がりを一緒に楽しみやすい二人です。笑えることと安心できることは別に確かめてください。`,
  middle: cue => `${cue}では、話題や場面によって掛け合いの楽しさが変わります。二人だけで笑えた出来事を重ねるほど自然さが育ちます。`,
  low: cue => `${cue}では、面白いと感じる速さや方向が違いやすい二人です。反応を求めず、相手が楽しむ形を観察してください。`,
}

const friendshipCompatibilityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、恋愛や役割を離れても話したいことを見つけやすい二人です。親友のような近さと、恋愛の約束は別に育ててください。`,
  middle: cue => `${cue}では、友達のように自然でいられる場面と、関係を意識する場面があります。共通の楽しみを一つ残してください。`,
  low: cue => `${cue}では、友達らしい気軽さより、目的のある会話の方が続きやすい二人です。無理に盛り上げず、共有できる時間を選んでください。`,
}

const domesticCompatibilityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、食事や休息など日々の過ごし方を重ねやすい二人です。ただし、一緒にいる時間の長さを心の深さとは決めないでください。`,
  middle: cue => `${cue}では、自然に共有できる習慣と調整が要る習慣があります。家事、休息、ひとりの時間を別々に決めてください。`,
  low: cue => `${cue}では、休み方や心地よい生活の速度に差が出やすい二人です。同じ暮らし方を求めず、譲れない条件から話してください。`,
}

const noveltyCompatibilityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、新しい場所や初めての体験を共有するほど関係が動きやすい二人です。ただし、刺激の強さを愛情の深さとは決めないでください。`,
  middle: cue => `${cue}では、新しい体験が力になる時と、慣れた時間が必要な時があります。挑戦する日と休む日を分けてください。`,
  low: cue => `${cue}では、変化を楽しむ速度や範囲に差が出やすい二人です。大きな挑戦より、片方が安心できる小さな新しさから試してください。`,
}

const sharedProjectCompatibilityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、役割を分けて一つの目標へ進む時に力が出やすい二人です。ただし、共同作業の充実を恋愛の充実とは決めないでください。`,
  middle: cue => `${cue}では、目標によって協力しやすさが変わります。始める人、整える人、続ける人の役割を先に確かめてください。`,
  low: cue => `${cue}では、頑張る速度や責任の持ち方に差が出やすい二人です。同じ方法を求めず、期限と担当を小さく区切ってください。`,
}

const adventureCompatibilityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、行き先を決めて一緒に動くほど二人の勢いが揃いやすい傾向があります。ただし、旅行中の高揚を日常の安定とは分けてください。`,
  middle: cue => `${cue}では、目的や準備量によって動きやすさが変わります。計画する側と現地で決める側の希望を先に合わせてください。`,
  low: cue => `${cue}では、出かける速度や未知への向き合い方に差が出やすい二人です。短時間の外出から互いの快適な範囲を探してください。`,
}

const admirationMutualText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、相手の考え方や行動の力を認めやすい二人です。ただし、尊敬することと相手の意見に従うことは分けてください。`,
  middle: cue => `${cue}では、認め合える分野と競い合いやすい分野が分かれます。結果だけでなく、相手が重ねた工夫を言葉にしてください。`,
  low: cue => `${cue}では、相手の力を評価する基準に差が出やすい二人です。自分と同じ方法を求めず、助かった行動を具体的に伝えてください。`,
}

const prideCollisionText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、内容より言い方や扱われ方が争点になりやすい二人です。勝ち負けを決める前に、何を尊重してほしかったかを伝えてください。`,
  middle: cue => `${cue}では、譲れる話題と自分を否定されたように感じる話題が分かれます。結論と相手への評価を切り離してください。`,
  low: cue => `${cue}では、意見の違いを自分への否定と結びつけにくい二人です。それでも、穏やかさを我慢の証拠とは決めないでください。`,
}

const egoCompetitionText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、相手の力を認めるほど、自分も負けたくない気持ちが動きやすい二人です。成果を比べる前に、互いが担った役割を言葉にしてください。`,
  middle: cue => `${cue}では、励まし合える分野と張り合いやすい分野が分かれます。競争する範囲と協力する範囲を先に決めてください。`,
  low: cue => `${cue}では、相手の成功を自分の評価と結びつけにくい二人です。それでも、競わないことを関心の薄さとは決めないでください。`,
}

const conflictFrequencyText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、小さな違いが話し合いのきっかけになりやすい二人です。回数だけで関係の良し悪しを決めず、同じ争点が繰り返されているかを見てください。`,
  middle: cue => `${cue}では、状況によって意見をぶつける回数が変わります。話題、疲れ、時間帯のどれが重なると増えるかを確かめてください。`,
  low: cue => `${cue}では、意見の違いが表面化する回数は多くありません。ただし、喧嘩が少ないことを本音がすべて届いている証拠とは決めないでください。`,
}

const ambitionAlignmentText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、目標へ力を注ぐことを互いに理解しやすい二人です。ただし、同じ熱量でも目指す先が同じとは決めず、優先順位を確かめてください。`,
  middle: cue => `${cue}では、頑張りたい時期と休みたい時期が重なることもずれることもあります。応援と同行のどちらを求めるか伝えてください。`,
  low: cue => `${cue}では、達成へ向ける熱量や評価を求める度合いに差が出やすい二人です。片方の目標を関係より大切だと決めつけないでください。`,
}

const lifestyleAlignmentText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、休む時や気持ちを切り替える時のリズムが重なりやすい二人です。ただし、自然に合うことを家事や役割の一致とは決めないでください。`,
  middle: cue => `${cue}では、心地よい過ごし方が重なる日とずれる日があります。予定だけでなく、一人で休む時間も先に伝えてください。`,
  low: cue => `${cue}では、日常の速度や落ち着く方法に差が出やすい二人です。同じ過ごし方を求めず、譲れない習慣を一つずつ確かめてください。`,
}

const sharedIdentityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、相手の存在を自分の日常や選択の一部として感じやすい二人です。ただし、近さを運命や関係の継続保証とは決めないでください。`,
  middle: cue => `${cue}では、二人で考える場面と一人で決めたい場面が分かれます。共通のことと個人のことを言葉で区切ってください。`,
  low: cue => `${cue}では、親しくても互いを独立した存在として捉えやすい二人です。一体感の弱さを愛情不足とは決めないでください。`,
}

const partnershipTeamFeelingText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、役割を持って同じ目標へ進むほど、二人で一つのチームだと感じやすい関係です。ただし、協力できることを恋愛の深さとは決めないでください。`,
  middle: cue => `${cue}では、課題によってチームになれる時と個別に進む方がよい時があります。担当と決定権を先に分けてください。`,
  low: cue => `${cue}では、同じ目標でも別々の方法で進む方が力を出しやすい二人です。一緒に動かないことを支え合えない証拠とは決めないでください。`,
}

const fateCompanionFeelingText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、相手を自分の人生の一部として記憶しやすい関係です。ただし、この感覚だけで運命の相手や将来の継続を断定しないでください。`,
  middle: cue => `${cue}では、人生を重ねて感じる場面と、それぞれの道を意識する場面があります。共通の経験と現在の選択を分けてください。`,
  low: cue => `${cue}では、親しくても互いの人生を一つにまとめず捉えやすい二人です。その距離を縁の弱さとは決めないでください。`,
}


const emotionalIntimacyText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、相手の気持ちの変化を深く受け取りやすい二人です。ただし、強く感じ取れることと安心して頼れることは別に育ててください。`,
  middle: cue => `${cue}では、自然に分かる気持ちと、言葉にしないと届かない気持ちがあります。察したことを確認へ変えるほど親密さが育ちます。`,
  low: cue => `${cue}では、同じ出来事でも心に残る部分が違いやすい二人です。分かり合えないと決めず、何が痛かったかを一つずつ伝えてください。`,
}

const repairCapacityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、すれ違っても関係を終わりと決めず、戻るきっかけを見つけやすい二人です。謝り方を決めておくと、その力が安定します。`,
  middle: cue => `${cue}では、戻れる時と気持ちを残す時があります。話す前に時間を置くのか、その日のうちに確認するのかを決めてください。`,
  low: cue => `${cue}では、同じ方法で仲直りしようとすると片方が置き去りになりやすい二人です。謝罪、説明、時間のどれが必要かを先に尋ねてください。`,
}

const forgivenessCapacityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、間違いを一度の結論にせず、相手の事情を受け取り直しやすい二人です。ただし、許すことと我慢を続けることは分けてください。`,
  middle: cue => `${cue}では、手放せる出来事と心に残る出来事が分かれます。謝罪の言葉だけでなく、次に変える行動まで確かめてください。`,
  low: cue => `${cue}では、傷ついた理由を理解できるまで気持ちを手放しにくい二人です。急いで許しを求めず、何を償うかを具体的にしてください。`,
}

const emotionalSafetyText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、揺れた気持ちを見せても関係がすぐ壊れるとは感じにくい二人です。それでも、沈黙を了承と決めず確認を続けてください。`,
  middle: cue => `${cue}では、安心して話せる場面と身を守りたくなる場面が分かれます。難しい話ほど、時間と場所を先に選んでください。`,
  low: cue => `${cue}では、気持ちを見せた時の反応に敏感になりやすい二人です。正しさより先に、否定せず最後まで聞く約束を作ってください。`,
}

const dependencyIntensityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、相手の反応や不在が心に強く残りやすい二人です。深く惹かれることを安心や幸福の証明にはせず、一人で整う時間も守ってください。`,
  middle: cue => `${cue}では、相手を強く求める時と、自分の距離を保てる時があります。不安が動いたら、愛情の確認より先に必要な安心を言葉にしてください。`,
  low: cue => `${cue}では、相手への強い執着より、それぞれの生活を保ちながら関係を育てやすい二人です。距離があることを気持ちの薄さとは決めないでください。`,
}

const powerBalanceText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、互いの主導権や譲れない感覚が拮抗しやすい二人です。対等さを良し悪しで決めず、どちらが決めるかを場面ごとに分けてください。`,
  middle: cue => `${cue}では、自然に役割が分かれる場面と、互いに譲りにくい場面があります。結論より先に、今は誰が責任を持つかを決めてください。`,
  low: cue => `${cue}では、主導する側と支える側が分かれやすい二人です。固定した上下関係にせず、得意分野ごとに役割を入れ替えてください。`,
}

const growthCompatibilityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、一緒に新しい目標へ向かう時ほど関係が生き生きしやすい二人です。挑戦の大きさより、互いの前進を認めてください。`,
  middle: cue => `${cue}では、同じ目標が力になる時と、別々に進む方がよい時があります。応援と同行のどちらが必要か確かめてください。`,
  low: cue => `${cue}では、成長したい方向や速度が違いやすい二人です。同じ歩幅を求めず、相手の変化を関係への拒絶と決めないでください。`,
}

const relationshipStimulationNeedText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、新しい体験や共通の目標があるほど関係が活性化しやすい二人です。刺激の不足を愛情の不足と決めず、小さな挑戦を共有してください。`,
  middle: cue => `${cue}では、新しさが必要な時と、慣れた時間で整う時があります。予定を増やす前に、二人が今ほしい変化の大きさを確かめてください。`,
  low: cue => `${cue}では、次々と変化を起こすより、安心できる日常の中へ小さな新しさを置く方が育ちやすい二人です。停滞と安定を混同しないでください。`,
}

const relationshipBoredomRiskText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、同じ過ごし方が続くと関係の勢いを感じにくくなる傾向があります。飽きを破局の兆しと決めず、外出や学びなど小さな共通体験を足してください。`,
  middle: cue => `${cue}では、慣れが安心になる時と刺激不足になる時があります。予定を増やすより、最近二人で初めて試したことを一つ思い出してください。`,
  low: cue => `${cue}では、変化を増やし続けなくても、馴染んだ時間から関係を育てやすい二人です。穏やかさを停滞と決めず、必要な時だけ新しさを選んでください。`,
}

const trustStabilityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、揺れたあとも言葉と行動を重ね直し、信頼を保ちやすい二人です。ただし、この値だけで秘密や裏切りがないとは予測できません。`,
  middle: cue => `${cue}では、信じられる場面と確認が必要な場面が分かれます。安心を察し合うより、守れた約束を具体的に積み重ねてください。`,
  low: cue => `${cue}では、一度の行き違いが長く残りやすい二人です。不信を人格の結論にせず、何を確認すれば安心へ戻れるかを小さく決めてください。`,
}

const longTermBindingText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、安心・暮らし・友情・修復を重ねるほど長期の土台を作りやすい二人です。ただし、惹かれる強さや交際期間だけで将来を保証しません。`,
  middle: cue => `${cue}では、続ける力になる要素と、調整が必要な摩擦が混ざります。気持ちだけでなく、暮らしと仲直りの約束を更新してください。`,
  low: cue => `${cue}では、長く続ける条件を自然には共有しにくい二人です。別れを予測する値ではなく、安心・生活・修復の不足を話す手がかりにしてください。`,
}

const transparencyText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、内側にある考えや気持ちを相手へ見せやすい傾向があります。ただし、開示のしやすさは二方向で異なるため、同じ深さとは決めません。`,
  middle: cue => `${cue}では、話せることと伏せておきたいことが人ごとに分かれます。互いに同じ量を求めず、今伝えられる範囲を確かめてください。`,
  low: cue => `${cue}では、気持ちを言葉にするまでの時間が二方向で違いやすい関係です。沈黙を秘密や拒絶と決めず、待てる期限を伝えてください。`,
}

const mysteryDistanceText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、相手の本音を読み取ろうとして推測が増えやすい方向があります。わからなさを嘘や拒絶と決めず、確認できる事実へ戻ってください。`,
  middle: cue => `${cue}では、自然にわかる場面と、言葉で確かめる場面が方向ごとに分かれます。察した内容を結論にせず、一度問い直してください。`,
  low: cue => `${cue}では、相手の意図を必要以上に推測せず、言葉と行動から関係を捉えやすい傾向があります。それでも確認は省かないでください。`,
}

const valueAlignmentText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、大切にしたい基準を共有しやすい二人です。似ているからこそ、変わった考えを言い直す時間を持ってください。`,
  middle: cue => `${cue}では、自然に重なる基準と、話して決める必要がある基準が混ざります。揃える項目を少数に絞ってください。`,
  low: cue => `${cue}では、同じ出来事にも違う意味を置きやすい二人です。結論を揃える前に、なぜ大切なのかを交換してください。`,
}

type ContextualProfileKey = 'conflict_intensity'
type StandaloneProfileKey = Exclude<CompatibilityProfileScore['key'], ContextualProfileKey>

const profileTextByScore: Record<StandaloneProfileKey, Record<ScoreBand, (cue: string) => string>> = {
  conversational_flow: conversationalFlowText,
  conversational_depth: conversationalDepthText,
  humor_compatibility: humorCompatibilityText,
  friendship_compatibility: friendshipCompatibilityText,
  domestic_compatibility: domesticCompatibilityText,
  novelty_compatibility: noveltyCompatibilityText,
  shared_project_compatibility: sharedProjectCompatibilityText,
  adventure_compatibility: adventureCompatibilityText,
  admiration_mutual: admirationMutualText,
  pride_collision: prideCollisionText,
  ego_competition: egoCompetitionText,
  conflict_frequency: conflictFrequencyText,
  ambition_alignment: ambitionAlignmentText,
  lifestyle_alignment: lifestyleAlignmentText,
  shared_identity: sharedIdentityText,
  partnership_team_feeling: partnershipTeamFeelingText,
  fate_companion_feeling: fateCompanionFeelingText,
  relationship_stimulation_need: relationshipStimulationNeedText,
  dependency_intensity: dependencyIntensityText,
  power_balance: powerBalanceText,
  relationship_boredom_risk: relationshipBoredomRiskText,
  trust_stability: trustStabilityText,
  long_term_binding: longTermBindingText,
  transparency: transparencyText,
  mystery_distance: mysteryDistanceText,
  emotional_intimacy: emotionalIntimacyText,
  repair_capacity: repairCapacityText,
  forgiveness_capacity: forgivenessCapacityText,
  emotional_safety: emotionalSafetyText,
  growth_compatibility: growthCompatibilityText,
  value_alignment: valueAlignmentText,
}

const profileSourceByScore: Record<StandaloneProfileKey, string> = {
  conversational_flow: '相性§44・§53',
  conversational_depth: '相性§10・§44・§52・§53',
  humor_compatibility: '相性§9・§44・§53',
  friendship_compatibility: '相性§9・§21・§34・§53',
  domestic_compatibility: '相性§25・§53・§57',
  novelty_compatibility: '相性§3・§26・§34・§53',
  shared_project_compatibility: '相性§4・§50・§53',
  adventure_compatibility: '相性§3・§26・§36・§53',
  admiration_mutual: '相性§19・§27・§33・§53',
  pride_collision: '相性§6・§19・§42・§53',
  ego_competition: '相性§4・§5・§19・§33・§53',
  conflict_frequency: '相性§6・§7・§13・§42・§53',
  ambition_alignment: '相性§3・§4・§5・§22・§53',
  lifestyle_alignment: '相性§14・§25・§53・§57',
  shared_identity: '相性§2・§35・§39・§53',
  partnership_team_feeling: '相性§2・§4・§5・§53',
  fate_companion_feeling: '相性§2・§35・§39・§53',
  relationship_stimulation_need: '相性§3・§26・§50・§53',
  dependency_intensity: '相性§35・§43・§53・§54',
  power_balance: '相性§5・§19・§33・§53',
  relationship_boredom_risk: '相性§3・§26・§28・§50',
  trust_stability: '相性§31・§34・§41・§57',
  long_term_binding: '相性§21・§28・§40・§41・§57',
  transparency: '相性§11・§29・§30・§31・§34',
  mystery_distance: '相性§11・§30',
  emotional_intimacy: '相性§43・§53・§54',
  repair_capacity: '相性§7・§42・§53',
  forgiveness_capacity: '相性§7・§53・§54',
  emotional_safety: '相性§7・§34・§42・§54',
  growth_compatibility: '相性§45・§53・§54',
  value_alignment: '相性§14・§34・§53・§54',
}

function isStandaloneProfileKey(key: CompatibilityProfileScore['key']): key is StandaloneProfileKey {
  return key !== 'conflict_intensity'
}

function band(value: number): ScoreBand {
  if (value >= 0.6) return 'high'
  if (value <= 0.4) return 'low'
  return 'middle'
}

const textByScore: Record<PairTraitScore['key'], Record<ScoreBand, (cue: string) => string>> = {
  compatibility_transparency: {
    high: cue => `${cue}では、言葉になる前の変化にも互いが気づきやすい二人です。気づいたことを確認できると、理解が信頼へ変わります。`,
    middle: cue => `${cue}では、察し合える時と説明が必要な時があります。小さな違和感ほど言葉にすると、思い込みを残しません。`,
    low: cue => `${cue}では、相手も同じように感じているという前提を置かないこと。事実と気持ちを分けて伝えるほど、誤解が減ります。`,
  },
  compatibility_independence: {
    high: cue => `${cue}では、一人で整える時間の感覚が近い二人です。離れている時間を拒絶と受け取らないことが、親しさを守ります。`,
    middle: cue => `${cue}では、一人でいたい時機をその都度確かめる必要があります。近さと自由を交互に選べる関係です。`,
    low: cue => `${cue}では、一人で整える時間の必要量が違います。距離を愛情の不足と決めず、戻る時刻まで約束してください。`,
  },
  compatibility_lifestyle: {
    high: cue => `${cue}では、日々の速度や休み方を揃えやすい二人です。小さな習慣を共有するほど、関係が自然に安定します。`,
    middle: cue => `${cue}では、合う習慣と別々にした方がよい習慣が混ざります。全部を揃えず、暮らしの要所だけ決めてください。`,
    low: cue => `${cue}では、生活の速度や休み方に差が出やすい二人です。正しさを競わず、互いの回復時間を先に確保してください。`,
  },
  compatibility_value_match: {
    high: cue => `${cue}では、大切にしたい基準を共有しやすい二人です。似ているからこそ、変化した考えを定期的に言い直してください。`,
    middle: cue => `${cue}では、重なる価値観と譲れない違いが同時にあります。何を揃え、何を別々に持つかを決めると安定します。`,
    low: cue => `${cue}では、同じ出来事にも異なる意味を置きやすい二人です。結論より先に、なぜ大切なのかを交換してください。`,
  },
}

/** 相性§41・§52・§53。確信度不足では一般論を生成せずnullへ戻す。 */
export function compatibilityScoreBlock(score: PairTraitScore | undefined, cue: string): CompatibilityScoreBlock | null {
  if (!score || score.confidence < 0.25) return null
  const scoreBand = band(score.value)
  return { scoreKey: score.key, band: scoreBand, text: textByScore[score.key][scoreBand](cue), source: '相性§41・§52・§53' }
}

/** 相性§43・§44・§53。話しやすさ／感情の深さ／安心感を混同しない。 */
export function compatibilityProfileBlock(score: CompatibilityProfileScore | undefined, cue: string): CompatibilityScoreBlock | null {
  if (!score || score.confidence < 0.25 || !isStandaloneProfileKey(score.key)) return null
  const scoreBand = band(score.value)
  return {
    scoreKey: score.key,
    band: scoreBand,
    text: profileTextByScore[score.key][scoreBand](cue),
    source: profileSourceByScore[score.key],
  }
}

/** 相性§7・§42。衝突強度だけで関係の良否を決めず、修復力と安心感を併記する。 */
export function relationshipTensionBlock(
  conflict: CompatibilityProfileScore | undefined,
  repair: CompatibilityProfileScore | undefined,
  safety: CompatibilityProfileScore | undefined,
  cue: string,
): CompatibilityScoreBlock | null {
  if (!conflict || conflict.key !== 'conflict_intensity' || conflict.confidence < 0.25) return null
  const conflictBand = band(conflict.value)
  const repairAvailable = repair?.key === 'repair_capacity' && repair.confidence >= 0.25
  const safetyAvailable = safety?.key === 'emotional_safety' && safety.confidence >= 0.25
  const returnStrength = Math.max(repairAvailable ? repair.value : 0, safetyAvailable ? safety.value : 0)
  const text = conflictBand === 'high' && returnStrength >= 0.6
    ? `${cue}では、反応が強くぶつかっても、関係へ戻る手がかりを見つけやすい二人です。勢いに任せず、仲直りの順序を決めてください。`
    : conflictBand === 'high'
      ? `${cue}では、言葉や行動の反応が強くなりやすい二人です。その場で決着を求めず、落ち着く時刻と話し直す時刻を分けてください。`
      : conflictBand === 'low'
        ? `${cue}では、表立った衝突は起こりにくい二人です。静かであることを納得と決めず、小さな違和感を定期的に確かめてください。`
        : `${cue}では、話題によって反応の強さが変わります。勝ち負けを決める前に、事実と受け取った気持ちを分けてください。`
  return { scoreKey: conflict.key, band: conflictBand, text, source: '相性§7・§42' }
}

/** 相性§52。理解の3成分を平均せず、確かな成分と届きにくい成分を同時に書く。 */
export function mutualUnderstandingBlock(profile: MutualUnderstandingProfile | undefined, cue: string): CompatibilityScoreBlock | null {
  if (!profile) return null
  const available = Object.values(profile.components).filter(component => component.confidence >= 0.25)
  if (!available.length) return null
  const strongest = [...available].sort((a, b) => b.confidence - a.confidence || b.value - a.value || a.key.localeCompare(b.key))[0]
  const weakest = [...available].sort((a, b) => a.value - b.value || b.confidence - a.confidence || a.key.localeCompare(b.key))[0]
  const scoreBand = band(strongest.value)
  const contrast = weakest.key !== strongest.key
    ? `一方、${understandingLabel[weakest.key]}は言葉で確かめてください。`
    : '分かったつもりで終わらず、本人の言葉で確かめてください。'
  const text = `${cue}では、${understandingLabel[strongest.key]}を受け取りやすい二人です。${contrast}`
  return { scoreKey: profile.key, band: scoreBand, text, source: '相性§10・§11・§44・§52・§53' }
}
