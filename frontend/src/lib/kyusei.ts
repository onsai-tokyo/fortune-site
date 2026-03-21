export const KYUSEI_NAMES = ['', '一白水星', '二黒土星', '三碧木星',
  '四緑木星', '五黄土星', '六白金星', '七赤金星', '八白土星', '九紫火星']

export const KYUSEI_ELEMENTS = ['', '水', '土', '木', '木', '土', '金', '金', '土', '火']

// 本命星の計算（節分基準：1月 または 2月3日以前は前年で計算）
export function calcHonmeiStar(birthYear: number, birthMonth: number, birthDay = 1): number {
  const year = (birthMonth === 1 || (birthMonth === 2 && birthDay < 4)) ? birthYear - 1 : birthYear
  return ((1999 - year) % 9 + 9) % 9 + 1
}

// 月命星の計算テーブル
export function calcTsukimeiStar(honmeiStar: number, birthMonth: number): number {
  const table: Record<number, number[]> = {
    1: [8, 7, 6, 5, 4, 3, 2, 1, 9, 8, 7, 6],
    2: [5, 4, 3, 2, 1, 9, 8, 7, 6, 5, 4, 3],
    3: [2, 1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 9],
    4: [8, 7, 6, 5, 4, 3, 2, 1, 9, 8, 7, 6],
    5: [5, 4, 3, 2, 1, 9, 8, 7, 6, 5, 4, 3],
    6: [2, 1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 9],
    7: [8, 7, 6, 5, 4, 3, 2, 1, 9, 8, 7, 6],
    8: [5, 4, 3, 2, 1, 9, 8, 7, 6, 5, 4, 3],
    9: [2, 1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 9],
  }
  return table[honmeiStar][birthMonth - 1]
}

export const KYUSEI_MEANINGS: Record<number, { personality: string; lucky_direction: string; lucky_color: string; year_fortune: string }> = {
  1: { personality: '柔軟性があり、流れを読む力に長けている。水のように環境に適応する。', lucky_direction: '北', lucky_color: '白・黒・紺', year_fortune: '内面を充実させる時期。焦らず流れに乗ることが吉。' },
  2: { personality: '忍耐強く、縁の下の力持ち。協調性が高く周囲をまとめる力がある。', lucky_direction: '南西', lucky_color: '黒・黄', year_fortune: '地道な努力が実る時期。人間関係を大切にすること。' },
  3: { personality: '行動力と決断力があり、新しいことへの挑戦を好む。', lucky_direction: '東', lucky_color: '緑・青', year_fortune: '新規スタートに吉。積極的に動くことで運が開く。' },
  4: { personality: '温厚で信頼性が高い。コツコツと努力を積み重ねる誠実さがある。', lucky_direction: '南東', lucky_color: '緑・白', year_fortune: '信頼関係を深める時期。継続的な努力が評価される。' },
  5: { personality: '中心的存在で強力なエネルギーを持つ。良くも悪くも影響力が大きい。', lucky_direction: '中心（全方位）', lucky_color: '黄・茶', year_fortune: '運気の転換点。慎重な判断が重要な時期。' },
  6: { personality: '誇り高く責任感が強い。リーダーシップと正義感を兼ね備える。', lucky_direction: '北西', lucky_color: '白・金', year_fortune: '実力を発揮できる時期。権威ある人との縁に注目。' },
  7: { personality: '社交的で楽しいことが好き。弁が立ち、人を喜ばせる才能がある。', lucky_direction: '西', lucky_color: '赤・金・ピンク', year_fortune: '人脈と楽しみが広がる時期。金銭管理には注意。' },
  8: { personality: '変化を好み、困難を乗り越える強さを持つ。山のように動じない安定感。', lucky_direction: '北東', lucky_color: '白・黄', year_fortune: '変化と転機の時期。大きなチャレンジに吉。' },
  9: { personality: '直感力と審美眼に優れる。華やかな存在感で人を引きつける。', lucky_direction: '南', lucky_color: '紫・赤・オレンジ', year_fortune: '実績が表舞台に出る時期。目立つ行動が吉。' },
}
