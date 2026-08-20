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

export const KYUSEI_NAMES = ['', '一白水星', '二黒土星', '三碧木星', '四緑木星', '五黄土星', '六白金星', '七赤金星', '八白土星', '九紫火星']
export const KYUSEI_ELEMENTS = ['', '水', '土', '木', '木', '土', '金', '金', '土', '火']
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
