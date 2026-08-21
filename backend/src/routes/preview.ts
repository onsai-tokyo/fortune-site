import { Router } from 'express'
import { createHash } from 'crypto'
import rateLimit from 'express-rate-limit'
import Anthropic from '@anthropic-ai/sdk'
import { verifyPaidToken } from './payment.js'
import { calcShichu, calcNayin, calcSanmei, calcExpandedDivination, calcSanmeiRelations, calcTimingCycles, calcNumerologyProfile, calcKyuseiProfile, getSukuyo, calcHonmeiStar, calcLifePathNumber, KYUSEI_NAMES } from './calc.js'
import { calcZiwei } from '../lib/ziwei.js'
import { calcAstrology } from '../lib/astrology.js'
import { requireReadingAuth } from '../middleware/auth.js'
import { extractReportMetadata, prioritizeCardsForConcern, type CurrentConcern, type CurrentRole } from '../lib/report/metadata.js'
import { writeReportWithAi } from '../lib/report/aiWriter.js'
import { correlationId, sendApiError } from '../lib/apiError.js'
import { buildReportFacts } from '../lib/report/facts.js'
import { buildReportFindings } from '../lib/report/findings.js'
import { buildEditorialStructuredReport } from '../lib/report/editorial.js'
import { replaceTimingCards } from '../lib/report/timingCards.js'
import { buildChartSections } from '../lib/report/chartSections.js'

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
  const useSse = req.query.format === 'sse'
  let keepAlive: ReturnType<typeof setInterval> | undefined
  const progress = (percent: number, title: string, detail: string) => {
    if (useSse) res.write(`data: ${JSON.stringify({ type: 'progress', percent, title, detail })}\n\n`)
  }
  try {
    const { birthDate, birthTime, birthplace, gender, nickname, currentRole, currentConcern } = req.body as {
      birthDate?: string
      birthTime?: string
      birthplace?: string
      gender?: string
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
    if (useSse) {
      res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Accel-Buffering', 'no'); res.flushHeaders()
      keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 10_000)
      res.once('close', () => { if (keepAlive) clearInterval(keepAlive) })
    }
    progress(5, '入力内容を確認しています', '生年月日と出生地を確認しています')

    const age = calcAge(birthDate)
    const genderLabel = gender === 'male' ? '男性' : '女性'
    const [year, month, day] = birthDate.split('-').map(Number)
    // サーバー側で正確に計算（フロント側の計算ライブラリのバグ回避）
    const [birthHour, birthMinute] = birthTime
      ? birthTime.split(':').map(Number)
      : [undefined, 0]
    progress(18, '命式を計算しています', '生まれた瞬間の基本データを整えています')
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
    progress(38, '複数の見方を重ねています', '共通する特徴を探しています')
    const reportInput = {
      birthDate,
      birthTime,
      birthplace,
      gender,
      age,
      shichuYear: shichu.year.kanshi,
      shichuMonth: shichu.month.kanshi,
      shichuDay: shichu.day.kanshi,
      shichuHour: shichu.hour?.kanshi ?? null,
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
    progress(58, 'あなたらしさを整理しています', '重複しない8つの視点を選んでいます')
    const metadata = extractReportMetadata(reportInput, { nickname, currentRole, currentConcern })
    const facts = buildReportFacts(reportInput, metadata)
    const findings = buildReportFindings(facts)
    const deterministicReport = replaceTimingCards(buildEditorialStructuredReport(facts, findings), reportInput)
    progress(76, '鑑定書を書いています', '一枚ずつ読める文章に整えています')
    const writtenReport = process.env.AI_REPORT_ENABLED === 'false'
      ? { ...deterministicReport, generator: 'deterministic' as const }
      : await writeReportWithAi(`${birthDate}|${birthplace ?? ''}|${gender}`, deterministicReport, metadata)
    const orderedReport = currentConcern
      ? { ...writtenReport, cards: prioritizeCardsForConcern(writtenReport.cards, currentConcern) }
      : writtenReport
    const reportWithChart = {
      ...orderedReport,
      cards: orderedReport.cards.filter(card => card.tab !== 'chart' && card.kind !== 'chart'),
      chartSections: buildChartSections(reportInput),
    }
    const response = req.query.debug === '1'
      ? { ...reportWithChart, metadata }
      : reportWithChart

    progress(92, '最後の確認をしています', 'ページの長さと根拠を確認しています')
    if (useSse) {
      res.write(`data: ${JSON.stringify({ type: 'complete', report: response })}\n\n`)
      progress(100, '鑑定書ができました', 'あなたのパターンを読み始められます'); res.write('data: [DONE]\n\n'); if (keepAlive) clearInterval(keepAlive); res.end()
    } else { res.setHeader('Cache-Control', 'private, no-store, max-age=0'); res.json(response) }
    return
  } catch (err) {
    if (keepAlive) clearInterval(keepAlive)
    const requestId = correlationId(req)
    console.error('Preview generate error', {
      correlationId: requestId,
      inputHash: requestCorrelationId(req.body),
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    if (!res.headersSent) {
      sendApiError(res, 500, 'GENERATION_FAILED', '鑑定書を生成できませんでした。もう一度お試しください。', true, requestId)
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', code: 'GENERATION_FAILED', error: '鑑定書を生成できませんでした。もう一度お試しください。', retryable: true })}\n\n`); res.write('data: [DONE]\n\n')
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
