import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { requirePoints } from '../middleware/points.js'
import { conciseConversationInstruction } from '../lib/conversationPrompt.js'
import { calcAge } from '../lib/age.js'

export const chatRouter = Router()

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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
}

function sanitize(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 600)
}

// メインチャット（2pt/メッセージ）
chatRouter.post('/', requireAuth, requirePoints(2), async (req: AuthRequest, res) => {
  try {
    const { conversationHistory, newMessage, birthDate, birthTime, gender, calculatedData, partnerBirthDate, partnerGender } = req.body as {
      conversationHistory?: ChatMessage[]
      newMessage?: string
      birthDate?: string
      birthTime?: string
      gender?: string
      calculatedData?: CalculatedData
      partnerBirthDate?: string
      partnerGender?: string
    }

    if (!newMessage?.trim()) {
      res.status(400).json({ error: 'メッセージが空です' })
      return
    }

    const sanitizedMsg = sanitize(newMessage)
    const history = (conversationHistory ?? [])
      .slice(-20)
      .filter((m): m is ChatMessage => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 2000) }))

    // Claude APIは最初のメッセージが'user'でないとエラーになるため先頭のassistantを除去
    while (history.length > 0 && history[0].role === 'assistant') {
      history.shift()
    }

    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      history.push({ role: 'user', content: sanitizedMsg })
    }

    // 現在の日付を取得
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const currentDay = today.getDate()
    const todayString = `${currentYear}年${currentMonth}月${currentDay}日`

    // 命式コンテキスト構築
    let meishikiContext = ''
    if (birthDate && gender && calculatedData) {
      const age = calcAge(birthDate) ?? 0
      const genderLabel = gender === 'male' ? '男性' : '女性'
      const [y, m, d] = birthDate.split('-').map(Number)
      meishikiContext = `
【本日の日付】${todayString}

【相談者の命式データ】
生年月日：${y}年${m}月${d}日${birthTime ? `　生誕時刻：${birthTime}` : ''}
性別：${genderLabel}　現在の年齢：${age}歳
四柱推命 — 年柱:${calculatedData.shichuYear} 月柱:${calculatedData.shichuMonth} 日柱:${calculatedData.shichuDay}${calculatedData.shichuHour ? ` 時柱:${calculatedData.shichuHour}` : ''}
納音：${calculatedData.nayin}
算命学 — 宿命星:${calculatedData.sanmeiStar}　天中殺:${calculatedData.chusatsu}
宿曜：${calculatedData.sukuyo}宿
数秘術（運命数）：${calculatedData.lifePathNumber}
九星気学（本命星）：${calculatedData.honmeiName}${calculatedData.archetype ? `\n${calculatedData.archetype}` : ''}${calculatedData.sukuyoDetail ? `\n${calculatedData.sukuyoDetail}` : ''}${partnerBirthDate ? `\n\n【相手の情報】生年月日：${partnerBirthDate}　性別：${partnerGender === 'male' ? '男性' : '女性'}` : ''}`
    }

    const systemPrompt = `提供された命式データだけを根拠に、安全な日本語で回答してください。
${conciseConversationInstruction}

【最重要】本日は${todayString}です。時期を言及する際は、必ず本日の日付を基準にしてください。過去の年月を未来として扱わないこと。

${meishikiContext}`

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = getClient().messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: history,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ delta: { text: event.delta.text } })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('❌ Chat error:', err)
    console.error('Error details:', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : undefined,
    })
    if (!res.headersSent) {
      res.status(500).json({ error: 'チャットの処理中にエラーが発生しました' })
    } else {
      res.write(`data: ${JSON.stringify({ error: 'エラーが発生しました' })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})
