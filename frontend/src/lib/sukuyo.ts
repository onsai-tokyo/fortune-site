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
  "婁": { name: "婁宿", element: "金", quality: "番犬", summary: "認めた相手には徹底的に従い、尽くす番犬の宿。上下関係を大切にし、上司や目上の人に引き立てられやすい。直観が鋭く、知らない人には警戒心むき出し、親しい人には愛想を振りまく。手先が器用で何でもこなせる実力者。味方にすると最強の存在だが、良き主人・師匠に巡り合えるかが人生の鍵。強情で過去の成功体験を引きずりやすい一面も。" },
  "胃": { name: "胃宿", element: "土", quality: "夢追い", summary: "男性は夢を追い続ける芸術肌で、現実を見ずに暴走しやすい。女性は現実的でリーダー素質があり、面倒見が良い。男女ともにリーダーにされやすく、おだてに乗りやすい。財運に課題があり、守銭奴にならず自分の力で生活することが大切。地に足をつけ、芸術的美的センスを磨くことが開運への鍵。" },
  "昴": { name: "昴宿", element: "日", quality: "幸運", summary: "生まれてきただけで幸運な、27宿中でも指折りの幸運の星。穏やかで物腰柔らかく上品な雰囲気があるが、良く言えば箱入り、悪く言うと世間知らずで浮世離れしている。物質欲がなく競争が苦手。学問や芸術領域で能力を発揮し、空想の世界が得意。飽きっぽく打たれ弱い面があり、理想と現実のバランスをとることが大切。陰で実力者を支えると成功しやすい。" },
  "畢": { name: "畢宿", element: "月", quality: "努力家", summary: "誠実でひたむきな努力家で、忍耐強さ・粘り強さは27宿トップクラス。マイペースなのんびり屋でスロースターターだが、目標を決めたら黙々と地道に努力する。義理人情が大好きで、心を許した人には尽くす。リーダーや主役体質でなく、陰で支える縁の下の力持ちが向いている。頑固さと緊急事態への弱さが玉にキズ。" },
  "觜": { name: "觜宿", element: "火", quality: "天然", summary: "悪気のない天然で陽気な宿で、いるだけで周囲が明るくなる。目上から可愛がられる親父キラーで、社交的で敵が少ない。27宿中の良識人で根が真面目、金銭感覚に優れている。おしゃべりが大好きだが失言には注意。本音を明かさない守りの本能が強く、開運は晩年に訪れる。" },
  "参": { name: "参宿", element: "水", quality: "子供心", summary: "子供がそのまま大人になったような、明るく元気でパワーがある宿。個性的なモノの見方や着眼点・発想力が持ち味で、義理人情に厚い。霊的感受性が鋭く、発した言葉がよく刺さるが不思議と憎まれない愛嬌がある。屁理屈を言って周囲を困らせる口の悪さ（「口は災いの元」）に注意。結婚相手によって人生が大きく変わる宿。" },
  "井": { name: "井宿", element: "木", quality: "合理主義", summary: "27宿中でも指折りの頭脳を持ち、最小の努力で最大の効果を得ようとする合理主義者。データ至上主義で分析力があり、何でも平均以上の能力を発揮する非常に幸運な宿。プライドが高く、組織のトップに立つと失敗しがち（永遠のNo.2向き）。心の中はデリケートでナイーブだが外には出さない。世渡り上手だが人付き合いを損得だけで考えすぎないことが大切。" },
  "鬼": { name: "鬼宿", element: "金", quality: "純粋", summary: "ピュア＆エネルギッシュが鬼宿のキーワード。純粋で陽気、生命力にあふれ、場を明るくする存在。困っている人をほっておけない優しさがあり、変化への適応力が高く執着心も少ない。信仰心が運を左右する宿で、先祖の加護が厚い。幼少期の環境と神仏との縁が運命を大きく左右する。" },
  "柳": { name: "柳宿", element: "土", quality: "くせ者", summary: "見た目の穏やかさとは裏腹に、アクの強さは27宿トップクラスのくせ者。人たらしで老獪、清濁併せ呑み人心掌握術に長けている。一生「ツキ」がついてくる三大王者の宿（柳・亢・尾）のひとつ。プライベートでは感情が理性を優先し、頑固さが相当。熱しやすく冷めやすい。自己顕示欲が出すぎると周囲から孤立するので注意。" },
  "星": { name: "星宿", element: "日", quality: "正直者", summary: "真面目な正直者で強い正義感・博愛精神を持つ宿。堅実で現実的、楽をして生きようとしない努力家。不器用な面もあり損な役回りを押し付けられやすいが、それが徳を高める。挫折には弱く心配性な面もある。愛想笑いやお世辞が苦手だが、柔軟性が加わると大きく伸びる。正義感と誠実さが運気を味方にする。" },
  "張": { name: "張宿", element: "月", quality: "話術", summary: "感情より世間の常識・周りの目を優先する理性の人。話し上手で説得力があり、民衆派カリスマになる素質がある。社交的・臨機応変で海外縁があり外国語が堪能な人も多い。ナルシスト気味で調子に乗ると大風呂敷を広げる癖に注意。色事での因縁（特に男性）と、ドロドロした争いに強みを持つ「猛悪宿」の面も持つ。" },
  "翼": { name: "翼宿", element: "火", quality: "熱血", summary: "熱いハートを持ち、強い正義感と真っ直ぐな理想主義が特徴。体育会系の精神論を好み、完璧主義で妥協を許さない。自分に厳しい一方で他人にも厳しいため、周囲を疲れさせることも。海外縁があり学問・社会問題への関心が高い。組織の中でこそ能力が発揮されるが、実力を伴わせ謙虚な心を常に持つことが大切。" },
  "軫": { name: "軫宿", element: "水", quality: "縁の下", summary: "人間関係がとても得意で、心優しく物腰が柔らかい宿。押しが弱く自己主張をしないが、芯は強く人の意見に流されない。縁の下の力持ちとして周囲をサポートすることが向いている。根に持つ一面もあり、考えすぎると精神を病むことも。行動力があり友人が多いが、もう少し自己主張すると世界が広がる。" },
  "角": { name: "角宿", element: "木", quality: "陽気", summary: "「楽しくなければ人生じゃない」をモットーに生きる、常に明るく前向きでポジティブな宿。遊び好きでエネルギーに満ち溢れ、フットワーク軽く誰からも好かれやすい。気分の波と好き嫌いが激しく、忍耐力に欠ける面が玉にキズ。運はそれほど多くないため、周囲の人を大切にし続けることが開運の鍵。" },
  "亢": { name: "亢宿", element: "金", quality: "龍", summary: "二十七宿中随一の大物が出る可能性を持つ龍の宿。「一人では何も成し得ない」宿命を持ち、支援者・協力者（雲）が必須。スケールが大きく庶民的で夢を語るカリスマ性がある。プライドが高く増上慢になりがちな点に注意。組織に属さず単独で周囲と連携するスタイルが最適。運気上昇は中年期まで。" },
  "氐": { name: "氐宿", element: "土", quality: "剛柔", summary: "外柔内剛・内柔外剛の二面性を持つ剛柔宿。パワフルな一面と繊細な一面の両方を持ち合わせ、見た目と内面のギャップが大きい。人生に大きな岐路が訪れるが乗り越えることで深い人間力が身につく。世渡りの巧みさと人心掌握術を持ち、一度信頼を得ると強い味方になる。美的センスと先見の明を持ち、個人経営や小さな単位での仕事が向いている。" },
  "房": { name: "房宿", element: "日", quality: "金運", summary: "27宿中1・2を争う幸運の星で、生涯お金には困らないとされる金運の宿。現実主義者で地に足がついており、頭の回転が速く行動的。目上からの引き立てが多く、何をやっても成功しやすい。ただし現実主義ゆえに人間関係が冷たいと思われやすい。感謝の気持ちを忘れずにいることでさらに幸運が循環する。" },
  "心": { name: "心宿", element: "月", quality: "繊細", summary: "人一倍繊細な心を持つ平和主義者。他人と無用な争いを起こさないよう自分を変えていく他人軸の宿。サービス精神旺盛で感受性が強く、他人が求めているものを感じ取る能力がある。常に明るく振舞うが本当は人間関係に疲れており、深読みしすぎて騙されやすい。怒らせると非常に怖く、信頼した人にだけ本心を見せる。" },
  "尾": { name: "尾宿", element: "火", quality: "武人", summary: "「武人の星」と言われる、強い信念と執念の努力家。情に厚く優しいが、自身の美意識や価値観が絶対のため人間関係で軋轢が生じやすい。負けず嫌いで闘争本能があり、敵に回すとかなり厄介。三大王者の命の宿（柳・亢・尾）のひとつ。神経質だが顔に出さず、美的センスがある。他人からの賞賛で自己評価を高めるタイプ。" },
  "箕": { name: "箕宿", element: "水", quality: "親分肌", summary: "面倒見の良い親分肌で、正義感が強く裏表がない開放的な宿。口が達者で頭の回転が速く、目上にも平気でモノが言える。反骨精神旺盛で闘争心が強く、味方も多いが敵も多い。最小の努力で最大の結果を狙う効率重視の面もあり、金銭感覚に優れている。お酒と口の悪さには要注意。" },
  "斗": { name: "斗宿", element: "木", quality: "施し", summary: "他人との関わりが運を左右する宿。優しく穏やかで施しを与えると自分が開運するという不思議な人徳を持つ。寂しがり屋で口下手、自己主張が苦手で押しが弱い。コツコツと地道な努力ができる完璧主義者で、直感が大体当たる。高い理想を持ちながら現実的な行動をとる。周囲を大切にし続けることで必ず開運する。" },
  "女": { name: "女宿", element: "土", quality: "志", summary: "行動が素早く一を聞いて十を知るコウモリの宿。行動力のタイムリミットは5分で決断は早いが深く考えない。志が強く私利私欲のない行動をとり、有力者をかぎ分ける特殊なレーダーを持つ。八方美人的に見えるが本人は志のためだけに動く。継続する力が開運の最大の鍵。" },
  "虚": { name: "虚宿", element: "日", quality: "スター気質", summary: "生まれ持ってのスター気質を持つ親分肌の宿。派手で格好いいことが好きで昔ながらの義理人情を重んじる。繊細さと感受性の高さが最大の特徴で、プライドが高い分だけ打たれ弱いガラスのハートを持つ。上から目線に見られがちだが内面は非常に繊細。精神面での安定が最大の人生テーマ。孤独に弱く、常に誰かとつながっていたい面も。" },
  "危": { name: "危宿", element: "月", quality: "自分本位", summary: "「今が楽しければいいじゃん」を地で行く、自分の感情が常に優先される宿。天真爛漫で裏表がないが、周囲の空気が読めない自分中心主義。独特の美的センスを持ち、個人で勝負できる世界で成功しやすい。行動が速くモテるが人間関係が淡泊で浮気リスクが高い。他人を少しでも意識できるようになると世界が劇的に変わる。" },
  "室": { name: "室宿", element: "火", quality: "大物気質", summary: "根拠がない自信に満ち溢れ、明朗快活で生命力にあふれた大物気質の宿。独特の存在感があり、どこにいてもオーラを放つ。徹底した自分中心主義者でドライな人間関係を望む。対人的な職業で成功しやすく処世術も身についているが、調子のよさと口先だけにならないよう注意。身内をとても大切にする一面を持つ。" },
  "壁": { name: "壁宿", element: "水", quality: "堅実", summary: "「カメのように着実に」が信条の堅実派。競争心は旺盛でなく、マイペースで忍耐強く目標に向かって歩む。縁の下の力持ちとして周囲をサポートする利他の精神を持つ誠実な正直者。真面目で合理的だが色事で失速しやすく、融通が利かず頼まれ事を断れない面も。神仏に縁があり独自の精神世界を大切にする。" },
  "奎": { name: "奎宿", element: "木", quality: "文才", summary: "文才と知性に優れ、書く・語る・伝える才能が際立つ宿。言葉で人の心を動かす力がある。和善宿に属し温厚で人と協調する気質を持つ。学習欲が高く知的探求を愛する。" },
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
  let solsticeYear = Math.floor((targetJDN - 1721425.5) / 365.25)
  let toji = findChuki(270, calcJDN(solsticeYear, 12, 22))
  // 旧暦11月の起点は対象日以前の直近の冬至。従来は常に同年12月の
  // 冬至を使っていたため、1月〜冬至直前の旧暦月が崩れていた。
  if (targetJDN < Math.floor(toji + 21 / 24)) {
    solsticeYear--
    toji = findChuki(270, calcJDN(solsticeYear, 12, 22))
  }

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
