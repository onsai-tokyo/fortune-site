import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { verifyPaidToken } from './payment.js'

export const reportRouter = Router()

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

reportRouter.post('/generate', async (req, res) => {
  try {
    const { fortuneData, reportToken } = req.body as {
      fortuneData: FortuneData
      reportToken: string
    }

    if (!reportToken || !verifyPaidToken(reportToken)) {
      res.status(403).json({ error: 'レポートトークンが無効です' })
      return
    }

    if (!fortuneData?.input?.birthDate) {
      res.status(400).json({ error: '解析データが不足しています' })
      return
    }

    const { input, shichu, nayin, sanmei, sukuyo, partner } = fortuneData
    const age = calcAge(input.birthDate)
    const genderLabel = input.gender === 'male' ? '男性' : '女性'
    const hourLine = shichu.hour
      ? `時柱: ${shichu.hour.kanshi}（${shichu.hour.element}・${shichu.hour.yinYang}）`
      : '時柱: 不明'

    const partnerSection = partner ? `
【比較対象データ】
性別: ${input.partnerGender === 'male' ? '男性' : '女性'}${input.partnerBirthDate ? `　生年月日: ${input.partnerBirthDate}` : ''}${input.partnerMbti ? `　MBTI: ${input.partnerMbti}` : ''}
四柱推命: 年柱=${partner.shichu.year.kanshi} 月柱=${partner.shichu.month.kanshi} 日柱=${partner.shichu.day.kanshi}
納音: ${partner.nayin}　宿命星: ${partner.sanmei.shukumeiStar}　天中殺: ${partner.sanmei.chusatsu}　宿曜: ${partner.sukuyo}宿` : ''

    const userContent = `【対象者データ】
性別: ${genderLabel}　年齢: ${age}歳　生年月日: ${input.birthDate}${input.mbti ? `　MBTI: ${input.mbti}` : ''}
四柱推命:
  年柱: ${shichu.year.kanshi}（${shichu.year.element}・${shichu.year.yinYang}）
  月柱: ${shichu.month.kanshi}（${shichu.month.element}・${shichu.month.yinYang}）
  日柱: ${shichu.day.kanshi}（${shichu.day.element}・${shichu.day.yinYang}）← 命主
  ${hourLine}
納音: ${nayin}
算命学: 宿命星=${sanmei.shukumeiStar} / 天中殺=${sanmei.chusatsu}
宿曜: ${sukuyo}宿${partnerSection}

【ご相談内容】
${sanitize(input.question)}

【レポート生成指示】
上記データを基に、以下6章構成で命式分析書を生成してください。

第一章：命式プロファイル
納音・宿曜・四柱の三軸から、この人物の根本的な気質・思考回路・行動様式を定義する。表面的な特徴ではなく、深層にある動機構造と価値観の核を読み解く。2〜3段落で掘り下げる。

第二章：外面と内面の乖離構造
他者からどう見られているか（社会的ペルソナ）と、内側に潜む本音・欲求・恐れのギャップを分析する。このギャップが引き起こしやすい対人摩擦や、逆に活用できる強みを具体的に示す。

第三章：恋愛・婚姻傾向
恋愛における引力パターン・惹かれる相手のタイプ・関係が深まるときと壊れるときのメカニズムを分析する。婚姻については、相性が良い命式の特徴と、結婚のタイミングに関わる運気を読む。${partner ? '比較対象者との相性については特に詳しく分析する。' : ''}

第四章：職業・財運の傾向
向いている職業領域・活かせる能力・財運のパターンを分析する。どのような環境で力を発揮しやすいか、どのような働き方が命式に合っているかを具体的に示す。

第五章：年単位バイオリズム（直近5年）
現在を起点に直近5年間を1年ごとに分析する。各年の運気の質・チャンスになる領域・注意すべきリスクを具体的に示す。

第六章：今すぐ実行すべき3つの戦略
命式と現在の運気を踏まえ、今この人物が取るべき具体的行動を3つ提示する。各戦略に「なぜ今なのか」「何をどう実行するか」を明記する。

【絶対ルール】
・箇条書き・記号（━━【】# *など）・アスタリスクは一切使わない
・各章のタイトルは「第一章：〜」という形式のみ許可
・アナリストとして断言する口調（「〜と分析される」「〜が最適解」「〜リスクが高まる」）
・「〜でしょう」「〜かもしれません」は禁止
・改行で区切った流れる文章で記述`

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const stream = getAnthropicClient().messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 6000,
      system: `あなたは最高水準の人生戦略データ解析システムのシニアアナリストです。東洋命理学（四柱推命・納音・算命学・宿曜）とMBTI心理指標を統合した、極めて詳細かつ実践的な分析レポートを生成します。このレポートは有料サービスの成果物であり、クライアントが具体的な人生戦略を立てるための根拠となる文書です。表面的な分析ではなく、データの深部から洞察を引き出し、実行可能な戦略提言として昇華させてください。`,
      messages: [{ role: 'user', content: userContent }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ delta: { text: event.delta.text } })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Report generate error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'レポートの生成中にエラーが発生しました' })
    } else {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})
