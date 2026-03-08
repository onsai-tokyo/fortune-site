import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'

export const chatRouter = Router()

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  sessionData: {
    userContent?: string
    fortuneData?: Record<string, unknown>
  }
  conversationHistory: ChatMessage[]
  newMessage: string
}

function sanitize(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 500)
}

chatRouter.post('/', async (req, res) => {
  try {
    const { sessionData, conversationHistory, newMessage } = req.body as ChatRequest

    if (!newMessage?.trim()) {
      res.status(400).json({ error: 'メッセージが空です' })
      return
    }

    const sanitizedMsg = sanitize(newMessage)

    // 会話履歴を構築（最大10往復）
    const history = (conversationHistory ?? [])
      .slice(-20)
      .filter((m): m is ChatMessage => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content.slice(0, 2000),
      }))

    // 最後のメッセージが user でない場合は追加
    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      history.push({ role: 'user', content: sanitizedMsg })
    }

    const contextNote = sessionData?.userContent
      ? `\n\n【鑑定コンテキスト】\n${sessionData.userContent}`
      : ''

    const systemPrompt = `あなたは四柱推命・納音・算命学・宿曜・MBTIを統合した熟練の占い師です。各占術の意味を深く理解し、具体的・温かみのある鑑定を行います。追加の相談には300〜500字で丁寧に回答してください。${contextNote}`

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = getAnthropicClient().messages.stream({
      model: 'claude-sonnet-4-5',
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
