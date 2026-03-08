import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'

export const fortuneRouter = Router()

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

interface Pillar {
  stem: string
  branch: string
  kanshi: string
  element: string
  yinYang: string
}

interface PersonData {
  shichu: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }
  nayin: string
  sanmei: { shukumeiStar: string; chusatsu: string }
  sukuyo: string
}

interface FortuneData extends PersonData {
  input: {
    birthDate: string
    birthTime: string
    gender: string
    mbti: string
    question: string
    partnerBirthDate: string
    partnerBirthTime: string
    partnerGender: string
    partnerMbti: string
  }
  partner?: PersonData
}

function sanitize(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 1000)
}

function calcAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function personBlock(label: string, p: PersonData, gender: string, mbti: string, birthDate?: string): string {
  const hourLine = p.shichu.hour
    ? `時柱: ${p.shichu.hour.kanshi}（${p.shichu.hour.element}・${p.shichu.hour.yinYang}）`
    : '時柱: 不明'
  const mbtiLine = mbti ? `MBTI: ${mbti}` : ''
  const genderLine = gender === 'male' ? '男性' : '女性'

  const ageLine = birthDate ? `生年月日: ${birthDate}（${calcAge(birthDate)}歳）` : ''

  return `【${label}】性別: ${genderLine}${ageLine ? ' / ' + ageLine : ''}${mbtiLine ? ' / ' + mbtiLine : ''}
四柱推命:
  年柱: ${p.shichu.year.kanshi}（${p.shichu.year.element}・${p.shichu.year.yinYang}）
  月柱: ${p.shichu.month.kanshi}（${p.shichu.month.element}・${p.shichu.month.yinYang}）
  日柱: ${p.shichu.day.kanshi}（${p.shichu.day.element}・${p.shichu.day.yinYang}）← 命主
  ${hourLine}
納音: ${p.nayin}
算命学: 宿命星=${p.sanmei.shukumeiStar} / 天中殺=${p.sanmei.chusatsu}
宿曜: ${p.sukuyo}宿`
}

function buildUserContent(fd: FortuneData): string {
  const hasPartner = !!fd.partner

  const myBlock = personBlock('あなた', fd, fd.input.gender, fd.input.mbti, fd.input.birthDate)
  const partnerBlock = hasPartner && fd.partner
    ? '\n\n' + personBlock('お相手', fd.partner, fd.input.partnerGender, fd.input.partnerMbti, fd.input.partnerBirthDate)
    : ''

  const compatSection = hasPartner ? `

【相性について】
二人の納音の組み合わせから愛情・感情面での相性を読む。宿曜の命宿関係から日常的な相性・引力を読む。四柱推命の五行バランスから補い合える点・衝突しやすい点を読む。` : ''

  return `${myBlock}${partnerBlock}

【ご相談内容】
${sanitize(fd.input.question)}

【鑑定指示】
占術の優先順位に従い、以下の流れで鑑定してください：
①まず納音からこの人の本質的な気質・愛情表現・人間関係のパターンを読む（最重要）
②宿曜からこの人の性格傾向・対人傾向を補足する
③四柱推命＋宿曜から現在の運気・時期の流れを読む${compatSection}

最後に、上記の読みを土台にして【ご相談内容】に具体的に答える。ここが鑑定の核心。

占術の名前や用語の説明は不要。占い師として自然な語り口で、この人に語りかけるように書く。`
}

fortuneRouter.post('/', async (req, res) => {
  try {
    const { fortuneData } = req.body as { fortuneData: FortuneData }

    if (!fortuneData?.input?.question) {
      res.status(400).json({ error: '必要な情報が不足しています' })
      return
    }

    const userContent = buildUserContent(fortuneData)
    const sessionData = { fortuneData, userContent }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = getAnthropicClient().messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      system: `あなたは30年以上の経験を持つ熟練の占い師です。

【絶対に守るルール】
・占術の名前・用語・概念の説明は一切しない。鑑定と相談への答えだけを語る
・「納音では〜」「四柱推命では〜」などの前置きをつけない
・占い師らしい自然な語り口で話す（「〜でしょう」「〜が見えます」「〜に違いありません」「〜の気がします」など）
・相談者に直接語りかける温かい文体にする
・箇条書き・見出し・記号（【】━━など）は使わない。文章だけで書く

【鑑定の核心】
相談内容への具体的な答えが鑑定の主役。性格分析は相談への答えを導くための背景として織り交ぜる。`,
      messages: [{ role: 'user', content: userContent }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ delta: { text: event.delta.text } })}\n\n`)
      }
    }

    res.write(`data: ${JSON.stringify({ sessionData })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Fortune error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: '鑑定の生成中にエラーが発生しました' })
    } else {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})
