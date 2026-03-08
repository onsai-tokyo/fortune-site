// 旧暦固定朔日宿テーブル方式（日本の宿曜サイトと一致）
// 旧暦各月の朔日(1日)に固定の宿が割り当てられ、そこから日数カウント
// 旧1月=室, 旧2月=奎, 旧3月=胃, 旧4月=畢, 旧5月=参, 旧6月=鬼
// 旧7月=張, 旧8月=角, 旧9月=氐, 旧10月=心, 旧11月=斗, 旧12月=虚

export const SUKUYO_ORDER = [
  "婁","胃","昴","畢","觜","参","井","鬼","柳","星","張","翼","軫",
  "角","亢","氐","房","心","尾","箕","斗","女","虚","危","室","壁","奎"
]

// 旧暦月1〜12の朔日宿インデックス（婁=0始まり）
const SAKUJITSU_SHU = [24, 26, 1, 3, 5, 7, 10, 13, 15, 17, 20, 22]

export interface SukuyoInfo {
  name: string
  element: string
  quality: string
  summary: string
}

export const SUKUYO_DATA: Record<string, SukuyoInfo> = {
  "婁": { name: "婁宿", element: "金", quality: "安定", summary: "誠実で義理堅く、信頼される人柄。地道な努力を惜しまず、周囲から頼られる存在。安定を好み、一度決めたことは最後までやり遂げる粘り強さを持つ。" },
  "胃": { name: "胃宿", element: "土", quality: "蓄積", summary: "勤勉で蓄積の才に恵まれた実務家。経済感覚に優れ、着実に財を築く力がある。保守的で慎重、信頼できる仲間を大切にする温かみのある性格。" },
  "昴": { name: "昴宿", element: "日", quality: "明晰", summary: "知性と審美眼に優れた完璧主義者。鋭い感受性で美しいものを見抜く力を持ち、高い理想に向かって進む。内面の豊かさと繊細な感性が特徴。" },
  "畢": { name: "畢宿", element: "月", quality: "慈愛", summary: "温かく包容力にあふれた愛情深い性格。人の気持ちに寄り添う共感力が高く、自然と人が集まってくる。家族や仲間を深く大切にする。" },
  "觜": { name: "觜宿", element: "火", quality: "探求", summary: "好奇心旺盛で多才な探求者。知識欲が強く新しいことへの挑戦を好む。機転が利き、どんな状況でも乗り越える柔軟な適応力を持つ。" },
  "参": { name: "参宿", element: "水", quality: "行動", summary: "行動力と決断力に優れたリーダー気質。正義感が強く、不正を見過ごせない熱い心の持ち主。率直で裏表がなく、仲間から信頼される。" },
  "井": { name: "井宿", element: "木", quality: "才智", summary: "頭の回転が速く多芸多才な才能人。コミュニケーション能力が高く、社交的で人脈を広げるのが得意。華やかな魅力で周囲を引きつける。" },
  "鬼": { name: "鬼宿", element: "金", quality: "霊感", summary: "鋭い直感と霊的な感受性を持つ神秘的な存在。見えないものを感じ取る特別な能力を持ち、深い洞察力で真実を見抜く力がある。" },
  "柳": { name: "柳宿", element: "土", quality: "粘り", summary: "粘り強く困難に立ち向かう不屈の精神の持ち主。感受性が豊かで芸術的センスに優れる。内に秘めた強さと優しさのバランスが魅力。" },
  "星": { name: "星宿", element: "日", quality: "輝き", summary: "華やかな存在感と強いカリスマ性を持つ輝く星。自己表現が豊かで創造力にあふれ、人々を魅了する。高い志と誇りを胸に生きる。" },
  "張": { name: "張宿", element: "月", quality: "拡大", summary: "大らかで寛大な心を持つ楽天家。物事を大きく捉え、積極的に拡大発展させる才能がある。明るく前向きな姿勢で周囲に活力を与える。" },
  "翼": { name: "翼宿", element: "火", quality: "芸術", summary: "芸術的感性と表現力に恵まれた創造者。美を愛し、独自の世界観を持つ個性派。繊細な感受性と強い意志が独特の魅力を生み出す。" },
  "軫": { name: "軫宿", element: "水", quality: "変容", summary: "変化と変容を恐れない柔軟な適応者。多面的な才能を持ち、どんな環境でも自分らしさを発揮する。深い思慮と洞察力が際立つ。" },
  "角": { name: "角宿", element: "木", quality: "先駆", summary: "先頭に立って道を切り開くパイオニア。強い意志と行動力で目標に向かって突き進む。正義感が強く、リーダーとして自然に人を惹きつける。" },
  "亢": { name: "亢宿", element: "金", quality: "純粋", summary: "純粋で高潔な心を持つ理想主義者。高い倫理観と誠実さで周囲から尊敬される。細やかな気配りと献身的な姿勢が人々の心を打つ。" },
  "氐": { name: "氐宿", element: "土", quality: "調和", summary: "調和を大切にする平和主義者。人間関係を円滑にする調整力に優れ、対立を和解に導く力がある。安定した環境を作り出す才能を持つ。" },
  "房": { name: "房宿", element: "日", quality: "明朗", summary: "明朗で活動的なエネルギーにあふれた存在。太陽のような明るさで周囲を照らし、自然とリーダーの立場に立つ。強い生命力と行動力が特徴。" },
  "心": { name: "心宿", element: "月", quality: "王者", summary: "生まれながらの王者の気質を持つ威厳ある存在。強いカリスマ性と責任感を持ち、周囲を力強くリードする。深い情と強さを兼ね備えている。" },
  "尾": { name: "尾宿", element: "火", quality: "子孫", summary: "子孫繁栄と継承の力を持つ豊かな存在。生命力が旺盛で、物事を育て発展させる才能がある。温かい家庭を築き、人々を養い育てる。" },
  "箕": { name: "箕宿", element: "水", quality: "受容", summary: "受容力と包容力にあふれる大きな器の持ち主。批判を建設的に活かす知恵があり、人々の多様性を受け入れる広い心を持つ。" },
  "斗": { name: "斗宿", element: "木", quality: "分配", summary: "公平な分配と管理の才に恵まれた実務家。正義感が強く、物事を公正に裁く判断力がある。組織の中で調整役として力を発揮する。" },
  "女": { name: "女宿", element: "土", quality: "技巧", summary: "繊細な技巧と巧みな手仕事の才能を持つ。細部への注意力が高く、完璧を目指す職人気質。謙虚で勤勉な姿勢が長期的な成功をもたらす。" },
  "虚": { name: "虚宿", element: "日", quality: "哲学", summary: "深い哲学的思考と内省の力を持つ探求者。表面に現れない深みと奥行きがあり、精神的な高みを目指す。孤独を恐れず真実を追い求める。" },
  "危": { name: "危宿", element: "月", quality: "建設", summary: "建設と創造の力にあふれる実行者。困難な状況でも着実に前進し、理想を形にする力がある。細部まで手を抜かない丁寧な仕事ぶりが評価される。" },
  "室": { name: "室宿", element: "火", quality: "神聖", summary: "神聖なエネルギーと霊的な力を持つ特別な存在。内なる光で周囲を照らし、人々に希望と勇気を与える。直感と霊感が強く、導く力がある。" },
  "壁": { name: "壁宿", element: "水", quality: "守護", summary: "強固な意志と守護の力を持つ頼れる存在。困難に立ち向かう強さと、大切なものを守り抜く忠誠心がある。堅実で信頼できる人柄が魅力。" },
  "奎": { name: "奎宿", element: "木", quality: "文学", summary: "文才と知性に優れた思考の人。書く・語る・伝える才能が際立ち、言葉で人の心を動かす力がある。学問や文化への造詣が深く、知的探求を愛する。" },
}

// Julian Day Number
function calcJDN(year: number, month: number, day: number): number {
  let y = year, m = month
  if (m <= 2) { y--; m += 12 }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524
}

// 新月JDE (Meeus "Astronomical Algorithms" ch.49)
function newMoonJDE(k: number): number {
  const T = k / 1236.85
  const DEG = Math.PI / 180
  let JDE = 2451550.09766 + 29.530588861 * k
    + 0.00015437 * T * T - 0.000000150 * T * T * T + 0.00000000073 * T * T * T * T
  const M  = (2.5534  + 29.10535670  * k - 0.0000014 * T * T) * DEG
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T) * DEG
  const F  = (160.7108 + 390.67050284 * k - 0.0016118 * T * T) * DEG
  const Om = (124.7746 -   1.56375588 * k + 0.0020672 * T * T) * DEG
  JDE += -0.40720 * Math.sin(Mp) + 0.17241 * Math.sin(M)
       +  0.01608 * Math.sin(2 * Mp) + 0.01039 * Math.sin(2 * F)
       +  0.00739 * Math.sin(Mp - M) - 0.00514 * Math.sin(Mp + M)
       +  0.00208 * Math.sin(2 * M)  - 0.00111 * Math.sin(Mp - 2 * F)
       -  0.00057 * Math.sin(Mp + 2 * F) + 0.00056 * Math.sin(2 * Mp + M)
       -  0.00042 * Math.sin(3 * Mp) + 0.00042 * Math.sin(M + 2 * F)
       +  0.00038 * Math.sin(M - 2 * F) - 0.00024 * Math.sin(2 * Mp - M)
       -  0.00017 * Math.sin(Om) - 0.00007 * Math.sin(Mp + 2 * M)
  return JDE
}

// targetJDNの直前の新月をJST基準で返す
function prevNewMoonJDN(targetJDN: number): { sakuJDN: number; k: number } {
  let k = Math.round((targetJDN - 0.5 - 2451550.09766) / 29.530588861)
  for (let dk = -2; dk <= 1; dk++) {
    const nm0 = Math.floor(newMoonJDE(k + dk)     + 21 / 24)
    const nm1 = Math.floor(newMoonJDE(k + dk + 1) + 21 / 24)
    if (nm0 <= targetJDN && targetJDN < nm1) {
      return { sakuJDN: nm0, k: k + dk }
    }
  }
  return { sakuJDN: Math.floor(newMoonJDE(k) + 21 / 24), k }
}

// 太陽黄経（簡易 Meeus）
function solarLongitude(JD: number): number {
  const T = (JD - 2451545.0) / 36525.0
  const DEG = Math.PI / 180
  const M = ((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360 + 360) % 360
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * DEG)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * M * DEG)
          + 0.000289 * Math.sin(3 * M * DEG)
  return ((M + C + 282.9372) % 360 + 360) % 360
}

// 太陽が targetLon° に達する日付を二分法で探索（nearJD付近）
function findChuki(targetLon: number, nearJD: number): number {
  let lo = nearJD - 20, hi = nearJD + 20
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    let lon = solarLongitude(mid)
    if (targetLon < 30 && lon > 300)  lon -= 360
    if (targetLon > 300 && lon < 30) lon += 360
    if (lon < targetLon) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

// 旧暦月(1〜12)を決定する
// 冬至(270°)を含む月=旧11月として、中気の有無で閏月を判定
function getKyureikiMonth(targetJDN: number): number {
  const { sakuJDN } = prevNewMoonJDN(targetJDN)

  // targetJDN 付近の冬至(270°)を探す（12月22日前後）
  const approxYear = Math.floor((targetJDN - 1721425.5) / 365.25)
  const tojiApprox = calcJDN(approxYear, 12, 22)
  const toji = findChuki(270, tojiApprox)

  // 冬至を含む月の朔 = 旧11月1日
  const m11saku = prevNewMoonJDN(Math.floor(toji + 21 / 24)).sakuJDN

  // 中気の黄経リスト（旧11月から順）
  const chukiLons = [270, 300, 330, 0, 30, 60, 90, 120, 150, 180, 210, 240]

  // m11saku から各月をスキャン：中気なし＝閏月
  let kyuMon = 11
  let chukiIdx = 0
  let k11 = Math.round((m11saku - 0.5 - 2451550.09766) / 29.530588861)

  for (let i = 0; i < 18; i++) {
    const currSaku = Math.floor(newMoonJDE(k11 + i)     + 21 / 24)
    const nextSaku = Math.floor(newMoonJDE(k11 + i + 1) + 21 / 24)

    // この月が target を含むか
    const isTarget = currSaku <= sakuJDN && sakuJDN < nextSaku

    // この月に中気があるか
    const targetLon = chukiLons[chukiIdx % 12]
    const chukiJST = findChuki(targetLon, currSaku + 15) + 21 / 24
    const hasChuki = chukiJST >= currSaku && chukiJST < nextSaku

    if (hasChuki) {
      if (isTarget) return kyuMon > 12 ? kyuMon - 12 : kyuMon
      chukiIdx++
      kyuMon = kyuMon >= 12 ? 1 : kyuMon + 1
    } else {
      // 閏月: 前月と同じ番号（簡易対応: 前月の朔日宿を引き続き使用）
      if (isTarget) {
        const prevMon = kyuMon > 12 ? kyuMon - 13 : kyuMon - 1
        return prevMon <= 0 ? 12 : prevMon
      }
    }
  }

  // フォールバック
  const months = Math.round((sakuJDN - m11saku) / 29.5)
  return ((10 + months) % 12) + 1
}

export function getSukuyo(year: number, month: number, day: number): string {
  const targetJDN = calcJDN(year, month, day)
  const { sakuJDN } = prevNewMoonJDN(targetJDN)
  const kyuDay   = targetJDN - sakuJDN + 1
  const kyuMonth = getKyureikiMonth(targetJDN)
  const sakuIdx  = SAKUJITSU_SHU[kyuMonth - 1]
  return SUKUYO_ORDER[(sakuIdx + kyuDay - 1) % 27]
}
