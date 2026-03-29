import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { requirePoints } from '../middleware/points.js'

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

function calcAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
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

    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      history.push({ role: 'user', content: sanitizedMsg })
    }

    // 命式コンテキスト構築
    let meishikiContext = ''
    if (birthDate && gender && calculatedData) {
      const age = calcAge(birthDate)
      const genderLabel = gender === 'male' ? '男性' : '女性'
      const [y, m, d] = birthDate.split('-').map(Number)
      meishikiContext = `
【相談者の命式データ】
生年月日：${y}年${m}月${d}日${birthTime ? `　生誕時刻：${birthTime}` : ''}
性別：${genderLabel}　年齢：${age}歳
四柱推命 — 年柱:${calculatedData.shichuYear} 月柱:${calculatedData.shichuMonth} 日柱:${calculatedData.shichuDay}${calculatedData.shichuHour ? ` 時柱:${calculatedData.shichuHour}` : ''}
納音：${calculatedData.nayin}
算命学 — 宿命星:${calculatedData.sanmeiStar}　天中殺:${calculatedData.chusatsu}
宿曜：${calculatedData.sukuyo}宿
数秘術（運命数）：${calculatedData.lifePathNumber}
九星気学（本命星）：${calculatedData.honmeiName}${calculatedData.archetype ? `\n${calculatedData.archetype}` : ''}${calculatedData.sukuyoDetail ? `\n${calculatedData.sukuyoDetail}` : ''}${partnerBirthDate ? `\n\n【相手の情報】生年月日：${partnerBirthDate}　性別：${partnerGender === 'male' ? '男性' : '女性'}` : ''}`
    }

    const systemPrompt = `あなたは四柱推命・算命学・宿曜・納音・数秘術・九星気学を30年以上研究してきた命術師です。
相談者の命式データをもとに、温かみと確信をもって鑑定を行います。
データに基づいた洞察を提供し、相談者が前に進むための具体的な指針を示します。
【重要】必ず日本語のみで記述。「〜でしょう」「〜かもしれません」は禁止。断言調で答える。
回答は300〜500字。箇条書き禁止。流れる文章で記述。最重要キーワードは **テキスト** で太字にする。${meishikiContext}`

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = getClient().messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
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
    console.error('Chat error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'チャットの処理中にエラーが発生しました' })
    } else {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})
