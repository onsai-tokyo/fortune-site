export function calcLifePathNumber(birthDate: string): number {
  const digits = birthDate.replace(/-/g, '').split('').map(Number)
  let sum = digits.reduce((a, b) => a + b, 0)
  if ([11, 22, 33].includes(sum)) return sum
  while (sum > 9) {
    sum = sum.toString().split('').map(Number).reduce((a, b) => a + b, 0)
    if ([11, 22, 33].includes(sum)) return sum
  }
  return sum
}

export function calcBirthdayNumber(day: number): number {
  if (day <= 9) return day
  return day.toString().split('').map(Number).reduce((a, b) => a + b, 0)
}

export const LIFE_PATH_MEANINGS: Record<number, { title: string; summary: string; talent: string; mission: string }> = {
  1: { title: 'リーダー', summary: '独立心が強く、開拓者精神を持つ', talent: 'リーダーシップ・独創性', mission: '自立して道を切り開くこと' },
  2: { title: '協調者', summary: '繊細で共感力が高く、調和を生む', talent: '協調性・直感力', mission: '人と人を繋ぎ平和をもたらすこと' },
  3: { title: 'クリエイター', summary: '表現力豊かで明るく創造的', talent: '表現力・コミュニケーション', mission: '喜びと創造を世界に広めること' },
  4: { title: '建設者', summary: '堅実で誠実、基盤を作る力がある', talent: '忍耐力・組織力', mission: '安定した基盤を築くこと' },
  5: { title: '自由人', summary: '変化を好み、自由と冒険を求める', talent: '適応力・行動力', mission: '変化をもたらし自由を体現すること' },
  6: { title: '奉仕者', summary: '愛情深く、家族や周囲を大切にする', talent: '責任感・愛情', mission: '愛と調和で周囲を癒すこと' },
  7: { title: '探求者', summary: '知性的で内省的、真理を追求する', talent: '分析力・直感', mission: '深い知恵を探求し伝えること' },
  8: { title: '達成者', summary: '野心的で現実的、大きな成功を掴む', talent: '実行力・判断力', mission: '豊かさと権力を正しく使うこと' },
  9: { title: '完成者', summary: '博愛的で人道的、大きな視野を持つ', talent: '包容力・芸術性', mission: '人類への奉仕と愛を実践すること' },
  11: { title: 'マスター・直感者', summary: '高い直感と霊感を持つマスターナンバー', talent: '直感・インスピレーション', mission: '精神的な啓示を世界に伝えること' },
  22: { title: 'マスター・建築家', summary: '大きな夢を現実化するマスターナンバー', talent: '実現力・統率力', mission: '世界規模の夢を形にすること' },
  33: { title: 'マスター・教師', summary: '無条件の愛と奉仕のマスターナンバー', talent: '愛・ヒーリング', mission: '無条件の愛で人類を導くこと' },
}
