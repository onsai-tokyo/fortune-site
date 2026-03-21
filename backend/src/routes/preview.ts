import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { verifyPaidToken } from './payment.js'

export const previewRouter = Router()

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function calcAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function sanitize(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 500)
}

interface CalculatedData {
  shichuYear: string
  shichuMonth: string
  shichuDay: string
  shichuHour?: string | null
  nayin: string
  sanmeiStar: string
  chusatsu: string
  sukuyo: string
  lifePathNumber: number
  honmeiName: string
  archetype?: string
  sukuyoDetail?: string
  daiyun?: string
  daiyunAge?: string
  ryunen?: string
}

// LP用：命式鑑定書 全章ストリーミング生成
// POST /api/preview/generate
previewRouter.post('/generate', async (req, res) => {
  try {
    const { birthDate, birthTime, gender, partnerBirthDate, partnerBirthTime, partnerGender, question, calculatedData } = req.body as {
      birthDate?: string
      birthTime?: string
      gender?: string
      partnerBirthDate?: string
      partnerBirthTime?: string
      partnerGender?: string
      question?: string
      calculatedData?: CalculatedData
    }

    if (!birthDate || !gender) {
      res.status(400).json({ error: '生年月日と性別は必須です' })
      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      res.status(400).json({ error: '生年月日の形式が正しくありません' })
      return
    }

    const age = calcAge(birthDate)
    const genderLabel = gender === 'male' ? '男性' : '女性'
    const [year, month, day] = birthDate.split('-').map(Number)
    const timeLine = birthTime ? `　生誕時刻：${birthTime}` : ''

    const hasPartner = !!partnerBirthDate && /^\d{4}-\d{2}-\d{2}$/.test(partnerBirthDate)
    const hasQuestion = !!(question?.trim())

    // 事前計算済み命式データ（クライアント側で正確に計算されたもの）
    const dataSection = calculatedData ? `
【事前計算済み命式データ（必ずこの値を使用すること。自分で計算しないこと）】
四柱推命 — 年柱:${calculatedData.shichuYear} 月柱:${calculatedData.shichuMonth} 日柱:${calculatedData.shichuDay}${calculatedData.shichuHour ? ` 時柱:${calculatedData.shichuHour}` : '（時柱不明）'}
納音：${calculatedData.nayin}
算命学 — 宿命星:${calculatedData.sanmeiStar}　天中殺:${calculatedData.chusatsu}
宿曜：${calculatedData.sukuyo}宿
数秘術（運命数）：${calculatedData.lifePathNumber}
九星気学（本命星）：${calculatedData.honmeiName}
四柱推命 年運データ — 現在の大運:${calculatedData.daiyun ?? '不明'}（${calculatedData.daiyunAge ?? ''}）　今年の流年:${calculatedData.ryunen ?? '不明'}${calculatedData.archetype ? `
【日柱アーキタイプ参照データ（分析の深化に使用。アーキタイプ名・動物名は出力に含めないこと）】
${calculatedData.archetype}` : ''}${calculatedData.sukuyoDetail ? `
【宿曜詳細データ（性格・年運の補強に使用）】
${calculatedData.sukuyoDetail}` : ''}` : ''

    const partnerLine = hasPartner
      ? `\n\n【相手の情報】\n生年月日：${partnerBirthDate}${partnerBirthTime ? `　生誕時刻：${partnerBirthTime}` : ''}　性別：${partnerGender === 'male' ? '男性' : '女性'}`
      : ''

    const questionLine = hasQuestion
      ? `\n\n【特に確認したいこと】\n${sanitize(question!)}`
      : ''

    const partnerChapter = hasPartner
      ? '\n【相性診断 — 二人の命式が示す関係性と未来】'
      : ''
    // 質問は別エンドポイント（有料）で処理するため初回生成には含めない

    const currentYear = new Date().getFullYear()
    const pastStart = currentYear - 20
    const futureEnd = currentYear + 9

    const prompt = `あなたは四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した最高峰の命理アナリストです。
四柱推命の日柱（命主）を分析の中心に置き、他の占術はそれを補強する形で使ってください。
【重要】必ず日本語のみで記述すること。韓国語・中国語・英語など他の言語は一切使わないこと。
【重要】現在年は${currentYear}年である。「今年」と書く場合は必ず${currentYear}年を指すこと。${currentYear - 1}年以前を「今年」と表現しないこと。

【過去の鑑定で精度が高かった実例（Few-shot参考）】
▼ 1985年6月6日生まれ・男性
・当たり：「何を考えているかわからない」という他者からの印象、恋愛は情熱的か無関心かの両極端という二面性
・注意：仕事の章は質問内容に引っ張られず命式のみで判断すること

▼ 1995年2月12日生まれ・女性
・当たり：自分が表に立って力を発揮するタイプ、顔や名前で売っていくスタイル、お母さんとの縁が深くお父さんとは距離がある
・傾向：パートナーの好みは社会的に突出した人物（起業家・リーダー）を好む。これは宿曜の「つく君主が重要」という特性と連動している

▼ 1995年2月20日5時40分生まれ・女性
・当たり：感情的な別れではなく「ある日突然心の扉を閉める」スタイル、愛情表現は行動で示すタイプ
・注意：年表の年齢は誕生日を厳密に考慮して計算すること（誕生日前後で1歳ずれる）

【対象者プロフィール】
生年月日：${year}年${month}月${day}日${timeLine}
性別：${genderLabel}　年齢：${age}歳${dataSection}${partnerLine}${questionLine}

以下の章立てで命式分析書を執筆してください。
各章は必ず「【章タイトル】」という形式の見出しから始め、200〜350文字程度で記述してください。

【性格特性 — あなたの本質と気質】
日柱を中心に、この人物の根本的な気質と思考パターンを読み解く。専門用語は使わず、誰でもわかる言葉で具体的に描写する。

【周りから見たあなた — 外面と内面のギャップ】
他者から見た印象と、内側の本音・欲求のギャップを分析する。日常の人間関係でどんな摩擦が起きやすいか、どんな強みに変えられるかを示す。

【仕事・適職 — 才能が開花する環境と職種】
命式から読み取れる職業適性・得意な働き方・活かせる才能を具体的な職種名を挙げながら示す。

【恋愛特徴 — 愛し方・愛され方のパターン】
どんな人に惹かれるか、関係が深まるとき・壊れるときのメカニズムを命式から読み解く。

【結婚相手の特徴 — 命式が示す理想の伴侶像】
相性の良い相手の特徴・気質・生まれた月や年の傾向を具体的に示す。

【子供との縁と特徴 — 子育てに宿る宿命】
子供との縁の深さ・子育てのスタイル・子供との関係性パターンを読む。

【親・兄弟との縁 — 家族が結んだ宿縁】
親との関係性・受けた影響・兄弟との縁の特徴を命式から読み解く。

【人生の使命 — この世に担って生まれた役割】
数秘術の運命数・九星気学の本命星・宿曜の宿を統合し、この魂が持って生まれた使命・人生テーマ・社会的役割を読み解く。なぜこの生年月日に生まれたのか、どのような貢献や体験をするために生まれてきたのかを断言する。他者への影響・社会での立ち位置・魂が目指す方向性を具体的に示す。

【人生の転換期 — 過去から未来の大きな変化（${pastStart}〜${futureEnd}年）】
四柱推命の大運・流年を主軸に据えて分析する。現在の大運干支と今年の流年干支が日柱・月柱・年柱とどう作用するかを読み解き、宿曜・算命学の天中殺で補強する。
${pastStart}年から${futureEnd}年の中で、転機・試練・飛躍・出会い・縁など特筆すべき動きがある年のみを抽出して記述する。
平穏・安定の年は一切書かない。各年は必ず「○○年（X歳）：内容」の形式で記述する。最低8年・最大15年を目安に抽出すること。

【あなたらしく生きるためのアドバイス】
命式と現在の運気を踏まえ、今この人物が取るべき具体的な行動と心がけを示す。${partnerChapter}

【絶対ルール】
・専門用語（干支の読み・五行・天干地支など）は一切使わない。使う場合は必ず平易な言葉で言い換える
・箇条書き・記号（*、#、━、【】以外の記号）は一切使わない
・「〜でしょう」「〜かもしれません」は禁止。断言調で書く
・改行で区切った流れる文章で記述
・四柱推命の日柱を主軸として、他の占術で補強する構成にすること
・各章の最重要な結論・キーワード・判断（例：最も向いている職種、婚期のタイミング、試練の年など）は **テキスト** の形式で太字にすること。ただし使いすぎず、各章につき2〜4箇所程度
・【仕事・適職】の章は「特に確認したいこと」の質問内容に一切引っ張られないこと。命式データのみから純粋に職業適性を判断すること
・【人生の転換期】の年齢表記は必ず正確に計算すること。生年月日${year}年${month}月${day}日生まれの場合、各年の誕生日前は「その年齢-1歳」、誕生日以降は「その年齢」として厳密に記述すること`

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = getClient().messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 9000,
      messages: [{ role: 'user', content: prompt }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ delta: { text: event.delta.text } })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Preview generate error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'プレビューの生成に失敗しました' })
    } else {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})

// 質問詳細回答（¥500 決済済みトークン必須）
// POST /api/preview/question
previewRouter.post('/question', async (req, res) => {
  try {
    const { question, calculatedData, questionToken, birthDate, gender } = req.body as {
      question?: string
      calculatedData?: CalculatedData
      questionToken?: string
      birthDate?: string
      gender?: string
    }

    if (!questionToken || !verifyPaidToken(questionToken)) {
      res.status(403).json({ error: '決済トークンが無効です' })
      return
    }
    if (!question?.trim()) {
      res.status(400).json({ error: '質問内容が必要です' })
      return
    }
    if (!birthDate || !gender) {
      res.status(400).json({ error: '生年月日と性別は必須です' })
      return
    }

    const age = calcAge(birthDate)
    const genderLabel = gender === 'male' ? '男性' : '女性'
    const [year, month, day] = birthDate.split('-').map(Number)

    const dataSection = calculatedData
      ? `四柱推命 — 年柱:${calculatedData.shichuYear} 月柱:${calculatedData.shichuMonth} 日柱:${calculatedData.shichuDay}${calculatedData.shichuHour ? ` 時柱:${calculatedData.shichuHour}` : ''}\n納音:${calculatedData.nayin}　宿命星:${calculatedData.sanmeiStar}　天中殺:${calculatedData.chusatsu}　宿曜:${calculatedData.sukuyo}宿　本命星:${calculatedData.honmeiName}`
      : ''

    const prompt = `あなたは四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した最高峰の命理アナリストです。
四柱推命の日柱を主軸に、以下の命式データをもとにご質問に対して深く詳細に回答してください。

【対象者プロフィール】
生年月日：${year}年${month}月${day}日　性別：${genderLabel}　年齢：${age}歳
${dataSection}

【ご質問】
${sanitize(question)}

【回答指示】
・命式データを具体的に根拠として活用しながら、600〜900文字で詳細に回答する
・ご質問に直接関連する占術データを優先的に参照する
・「なぜそうなのか」「今後どう動くべきか」まで踏み込んで断言する
・専門用語は使わず平易な言葉で記述する
・最重要な結論とキーワードは **テキスト** の形式で太字にする（4〜6箇所）
・「〜でしょう」「〜かもしれません」は禁止。断言調で書く
・箇条書きは禁止。流れる文章で記述する`

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = getClient().messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ delta: { text: event.delta.text } })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Question answer error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: '回答の生成に失敗しました' })
    } else {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})
