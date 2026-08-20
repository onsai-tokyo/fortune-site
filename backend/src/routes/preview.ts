import { Router } from 'express'
import { createHash } from 'crypto'
import rateLimit from 'express-rate-limit'
import Anthropic from '@anthropic-ai/sdk'
import { verifyPaidToken } from './payment.js'
import { calcShichu, calcNayin, calcSanmei, calcExpandedDivination, calcSanmeiRelations, calcTimingCycles, calcNumerologyProfile, calcKyuseiProfile, getSukuyo, calcHonmeiStar, calcLifePathNumber, KYUSEI_NAMES } from './calc.js'
import { buildDeterministicStructuredReport } from '../lib/deterministicReport.js'
import { calcZiwei } from '../lib/ziwei.js'
import { calcAstrology } from '../lib/astrology.js'
import { requireReadingAuth } from '../middleware/auth.js'
import { extractReportMetadata, prioritizeCardsForConcern, type CurrentConcern, type CurrentRole } from '../lib/report/metadata.js'

export const previewRouter = Router()

const questionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Math.max(1, Number(process.env.PREVIEW_QUESTION_RATE_LIMIT ?? 6)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '短時間に質問が続いています。少し待ってから再度お試しください。' },
})

function requestCorrelationId(body: unknown): string {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const birthDate = typeof input.birthDate === 'string' ? input.birthDate : ''
  const birthplace = typeof input.birthplace === 'string' ? input.birthplace : ''
  return createHash('sha256').update(`${birthDate}|${birthplace}`).digest('hex').slice(0, 8)
}

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

function removeEmoji(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // 絵文字範囲
    .replace(/[\u{2600}-\u{27BF}]/gu, '')   // 装飾記号
    .replace(/[\u{2300}-\u{23FF}]/gu, '')   // その他の装飾
    .replace(/[\u{2000}-\u{206F}]/gu, '')   // 一般句読点
    .replace(/\*\*/g, '')                    // **記号を削除
    .replace(/---/g, '')                     // ---を削除
    .replace(/===/g, '')                     // ===を削除
    .trim()
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
previewRouter.post('/generate', requireReadingAuth, async (req, res) => {
  try {
    const { birthDate, birthTime, birthplace, gender, partnerBirthDate, partnerBirthTime, partnerGender, question, calculatedData, nickname, currentRole, currentConcern } = req.body as {
      birthDate?: string
      birthTime?: string
      birthplace?: string
      gender?: string
      partnerBirthDate?: string
      partnerBirthTime?: string
      partnerGender?: string
      question?: string
      calculatedData?: CalculatedData
      nickname?: string
      currentRole?: CurrentRole
      currentConcern?: CurrentConcern
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

    // サーバー側で正確に計算（フロント側の計算ライブラリのバグ回避）
    const [birthHour, birthMinute] = birthTime
      ? birthTime.split(':').map(Number)
      : [undefined, 0]
    const shichu = calcShichu(year, month, day, birthHour, birthMinute)
    const nayin = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays)
    const expanded = calcExpandedDivination(shichu)
    const sukuyo = getSukuyo(year, month, day)
    const honmei = calcHonmeiStar(year, month, day)
    const kyuseiProfile = calcKyuseiProfile(year, month, day, birthHour, birthMinute)

    // 運命数の計算（既存ロジック）
    const lifePathNumber = calcLifePathNumber(birthDate)
    const numerologyProfile = calcNumerologyProfile(year, month, day)

    // 初回鑑定は計算結果から固定文を生成する。AI APIは使用せず、同じ入力には同じ結果を返す。
    const timing = calcTimingCycles(year, month, day, birthHour, birthMinute, gender === 'male' ? 'male' : 'female')
    const sanmeiRelations = calcSanmeiRelations(shichu, sanmei.chusatsu)
    const ziwei = calcZiwei(year, month, day, birthHour, gender === 'male' ? 'male' : 'female', birthplace)
    const astrology = calcAstrology(year, month, day, birthHour, birthMinute, birthplace)
    const reportInput = {
      birthDate,
      birthTime,
      birthplace,
      gender,
      age,
      shichuDay: shichu.day.kanshi,
      nayin,
      sanmeiStar: sanmei.shukumeiStar,
      chusatsu: sanmei.chusatsu,
      sukuyo,
      lifePathNumber,
      numerologyProfile,
      honmeiName: KYUSEI_NAMES[honmei],
      kyuseiProfile,
      timing,
      sanmeiRelations,
      ziwei,
      astrology,
      ...expanded,
    }
    const deterministicReport = buildDeterministicStructuredReport(reportInput)
    const orderedReport = currentConcern
      ? { ...deterministicReport, cards: prioritizeCardsForConcern(deterministicReport.cards, currentConcern) }
      : deterministicReport
    const response = req.query.debug === '1'
      ? { ...orderedReport, metadata: extractReportMetadata(reportInput, { nickname, currentRole, currentConcern }) }
      : orderedReport

    res.setHeader('Cache-Control', 'private, no-store, max-age=0')
    res.json(response)
    return

    /* Legacy AI report generator retained temporarily for reference.
    const dataSection = `
【占術データ（サーバー側で正確に計算）】
四柱推命 — 年柱:${shichu.year.kanshi} 月柱:${shichu.month.kanshi} 日柱:${shichu.day.kanshi}
納音：${nayin}
算命学 — 宿命星:${sanmei.shukumeiStar}　天中殺:${sanmei.chusatsu}
宿曜：${sukuyo}宿
数秘術（運命数）：${lifePathNumber}
九星気学（本命星）：${KYUSEI_NAMES[honmei]}`

    const partnerLine = hasPartner
      ? `\n\n【相手の情報】\n生年月日：${partnerBirthDate}${partnerBirthTime ? `　生誕時刻：${partnerBirthTime}` : ''}　性別：${partnerGender === 'male' ? '男性' : '女性'}`
      : ''

    // 質問は別エンドポイント（/api/preview/question）で処理するため本文生成には含めない

    const partnerChapter = hasPartner
      ? '\n【相性診断 — 二人の命式が示す関係性と未来】'
      : ''
    // 質問は別エンドポイント（有料）で処理するため初回生成には含めない

    const currentYear = new Date().getFullYear()
    const pastStart = currentYear - 20
    const futureEnd = currentYear + 9

    // 年齢対照表を事前計算（AIに計算させるとずれるため）
    const ageTable = Array.from({ length: futureEnd - pastStart + 1 }, (_, i) => {
      const y = pastStart + i
      // その年の誕生日を迎えた後の年齢
      const ageAfterBirthday = y - year
      // その年の誕生日前の年齢
      const ageBeforeBirthday = ageAfterBirthday - 1
      return `${y}年：誕生日(${month}/${day})前は${ageBeforeBirthday}歳、以降は${ageAfterBirthday}歳`
    }).join('\n')

    const prompt = `あなたは四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した最高峰の命理アナリストです。
四柱推命の日柱（命主）を分析の中心に置き、他の占術はそれを補強する形で使ってください。
【重要】必ず日本語のみで記述すること。韓国語・中国語・英語など他の言語は一切使わないこと。
【重要】現在年は${currentYear}年である。「今年」と書く場合は必ず${currentYear}年を指すこと。${currentYear - 1}年以前を「今年」と表現しないこと。
【重要】この鑑定は命式データのみに基づいて行うこと。対象者の具体的な生活状況・趣味・職業・人間関係など、命式以外の情報は一切参照しないこと。

【対象者プロフィール】
生年月日：${year}年${month}月${day}日${timeLine}
性別：${genderLabel}　年齢：${age}歳${dataSection}${partnerLine}

以下の章立てで命式分析書を執筆してください。
各章は必ず「【章タイトル】」という形式の見出しから始め、600〜1000文字程度の詳細な内容で記述してください。

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

【年齢対照表 — 必ずこの表を参照して年齢を記述すること。自分で計算しないこと】
${ageTable}

【あなたらしく生きるためのアドバイス】
命式と現在の運気を踏まえ、今この人物が取るべき具体的な行動と心がけを示す。${partnerChapter}

【絶対ルール】
・専門用語（干支の読み・五行・天干地支など）は一切使わない。使う場合は必ず平易な言葉で言い換える
・箇条書き・記号（*、#、━、【】以外の記号）は一切使わない
・「##」「###」「---」「===」などのMarkdown記法は絶対に使わない
・「〜でしょう」「〜かもしれません」は禁止。断言調で書く
・改行で区切った流れる文章で記述
・四柱推命の日柱を主軸として、他の占術で補強する構成にすること
・各章の最重要な結論・キーワード・判断（例：最も向いている職種、婚期のタイミング、試練の年など）は **テキスト** の形式で太字にすること。ただし使いすぎず、各章につき2〜4箇所程度
・【仕事・適職】の章は「特に確認したいこと」の質問内容に一切引っ張られないこと。命式データのみから純粋に職業適性を判断すること
・【人生の転換期】の年齢は必ず上記の年齢対照表から引用すること。自分で計算しないこと
・ユーザーが明示していない具体的な行動・職業・ツール名・人間関係・固有名詞は絶対に断言しない。命式から読み取れる「傾向・性質・テーマ」は断言してよいが、ユーザーの言葉にない具体的事実を創作しないこと`

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = getClient().messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      temperature: 0,  // 同じ生年月日には常に同じ結果を返す
      messages: [{ role: 'user', content: prompt }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const cleanedText = removeEmoji(event.delta.text)
        res.write(`data: ${JSON.stringify({ delta: { text: cleanedText } })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
    */
  } catch (err) {
    console.error('Preview generate error', {
      correlationId: requestCorrelationId(req.body),
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    if (!res.headersSent) {
      res.status(500).json({
        error: 'プレビューの生成に失敗しました',
        ...(process.env.NODE_ENV !== 'production' ? { detail: err instanceof Error ? err.message : String(err) } : {}),
      })
    } else {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})

// 質問詳細回答（¥500 決済済みトークン必須）
// POST /api/preview/question
previewRouter.post('/question', questionLimiter, async (req, res) => {
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
        const cleanedText = removeEmoji(event.delta.text)
        res.write(`data: ${JSON.stringify({ delta: { text: cleanedText } })}\n\n`)
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
