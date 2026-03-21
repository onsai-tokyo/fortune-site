import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'

export const analyzeRouter = Router()

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function parseJSON(text: string) {
  const cleaned = text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(cleaned)
}

function calcAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

interface Pillar { kanshi: string; element: string; yinYang: string }
interface PersonBlock {
  shichu: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }
  nayin: string
  sanmei: { shukumeiStar: string; chusatsu: string }
  sukuyo: string
}

function buildPersonCtx(p: PersonBlock, meta: { birthDate: string; gender: string; mbti?: string }, label: string): string {
  const age = calcAge(meta.birthDate)
  const gender = meta.gender === 'male' ? '男性' : meta.gender === 'female' ? '女性' : '不明'
  const hourPart = p.shichu.hour ? `/時柱${p.shichu.hour.kanshi}(${p.shichu.hour.element}${p.shichu.hour.yinYang})` : ''
  return `【${label}】生年月日:${meta.birthDate}(${age}歳) 性別:${gender} MBTI:${meta.mbti || '不明'} 四柱推命:年柱${p.shichu.year.kanshi}(${p.shichu.year.element}${p.shichu.year.yinYang})/月柱${p.shichu.month.kanshi}(${p.shichu.month.element}${p.shichu.month.yinYang})/日柱${p.shichu.day.kanshi}(${p.shichu.day.element}${p.shichu.day.yinYang})${hourPart} 納音:${p.nayin} 宿命星:${p.sanmei.shukumeiStar} 天中殺:${p.sanmei.chusatsu} 宿曜:${p.sukuyo}宿`
}

// 自己分析（強み・弱み・適職・転換期）
analyzeRouter.post('/self', async (req, res) => {
  try {
    const { fortuneData } = req.body
    const { input, shichu, nayin, sanmei, sukuyo } = fortuneData
    const age = calcAge(input.birthDate)
    const currentYear = new Date().getFullYear()
    const ctx = buildPersonCtx({ shichu, nayin, sanmei, sukuyo }, input, 'あなた')

    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'あなたは四柱推命・算命学・宿曜・納音・MBTIを統合した精密自己分析AIです。命式データから科学的・定量的な分析をJSONのみで返します。マークダウン・コードブロック・余分なテキストは一切禁止。数値スコアは命式の特徴から論理的に算出すること。',
      messages: [{
        role: 'user',
        content: `${ctx}\n\n以下のJSON形式のみで出力（他のテキスト不要）:\n{"corePersonality":"本質タイプを一文（〜タイプ）","lifeTheme":"人生テーマをキャッチコピーで","strengths":[{"name":"強みの名前4〜8文字","score":88,"description":"この強みが現れる具体的な場面を50文字以内"}],"weaknesses":[{"name":"弱みの名前4〜8文字","description":"弱みの説明40文字以内","advice":"具体的な改善ヒント50文字以内"}],"careers":[{"title":"職種・職業名","match":92,"reason":"マッチする理由40文字以内"}],"turningPoints":[{"year":${currentYear},"age":${age},"theme":"転換期テーマ15文字以内","description":"詳細な説明50文字以内","type":"opportunity"}]}\nstrengths5つ(score降順)、weaknesses3つ、careers5つ(match降順)、turningPoints直近5年(${currentYear}〜${currentYear + 4})を必ず含める。typeは"opportunity"|"challenge"|"transformation"のいずれか`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    res.json(parseJSON(content.text))
  } catch (err) {
    console.error('Self analysis error:', err)
    res.status(500).json({ error: '自己分析の生成に失敗しました' })
  }
})

// 相性診断（仕事・恋愛）
analyzeRouter.post('/compatibility', async (req, res) => {
  try {
    const { fortuneData, partnerBlock } = req.body
    const { input, shichu, nayin, sanmei, sukuyo } = fortuneData
    const selfCtx = buildPersonCtx({ shichu, nayin, sanmei, sukuyo }, input, 'あなた')

    let partnerCtx = ''
    if (fortuneData.partner) {
      partnerCtx = buildPersonCtx(fortuneData.partner, {
        birthDate: input.partnerBirthDate,
        gender: input.partnerGender,
        mbti: input.partnerMbti,
      }, 'お相手')
    } else if (partnerBlock) {
      partnerCtx = buildPersonCtx(partnerBlock, {
        birthDate: partnerBlock.birthDate,
        gender: partnerBlock.gender || 'unknown',
        mbti: partnerBlock.mbti,
      }, 'お相手')
    }

    if (!partnerCtx) {
      res.status(400).json({ error: '相手の情報が必要です' })
      return
    }

    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: '四柱推命・算命学・宿曜・納音を統合した相性分析AIです。二人の命式から科学的な相性スコアと分析をJSONのみで返します。マークダウン・余分なテキスト禁止。',
      messages: [{
        role: 'user',
        content: `${selfCtx}\n${partnerCtx}\n\n以下のJSON形式のみで出力:\n{"overall":78,"work":{"score":85,"summary":"仕事上の相性を一文50文字以内","strengths":["強み1","強み2"],"challenges":["課題1"],"advice":"仕事での付き合い方50文字以内"},"romantic":{"score":72,"summary":"恋愛・プライベートの相性を一文50文字以内","strengths":["強み1","強み2"],"challenges":["課題1"],"advice":"関係を深めるアドバイス50文字以内"},"dynamic":"二人の本質的な関係性を一文"}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    res.json(parseJSON(content.text))
  } catch (err) {
    console.error('Compatibility error:', err)
    res.status(500).json({ error: '相性診断の生成に失敗しました' })
  }
})

// 組織診断
analyzeRouter.post('/organization', async (req, res) => {
  try {
    const { selfData, members } = req.body
    const selfCtx = buildPersonCtx(selfData, selfData.input, `${selfData.input.selfName || 'あなた'}`)
    const memberCtxs = members.map((m: PersonBlock & { name: string; birthDate: string; gender?: string }) =>
      buildPersonCtx(m, { birthDate: m.birthDate, gender: m.gender || 'unknown' }, m.name)
    ).join('\n')
    const allNames = [selfData.input.selfName || 'あなた', ...members.map((m: { name: string }) => m.name)]

    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: '四柱推命・算命学・宿曜・納音を統合した組織分析AIです。複数メンバーの命式から組織特性・人間関係・戦略をJSONのみで返します。マークダウン・余分なテキスト禁止。',
      messages: [{
        role: 'user',
        content: `メンバー情報:\n${selfCtx}\n${memberCtxs}\n\n以下のJSON形式のみで出力:\n{"teamScore":82,"teamType":"この組織のタイプ名","keyPerson":{"name":"キーマンの名前","reason":"なぜキーマンか50文字以内"},"battleStrategy":"この組織の戦い方・強みの活かし方を具体的に100文字以内","strengths":["組織の強み1","強み2","強み3"],"challenges":["課題1","課題2"],"relationships":[{"members":["名前A","名前B"],"dynamic":"補完|協力|緊張|中立","description":"二人の関係性40文字以内"}],"roles":[{"name":"メンバー名","suggestedRole":"最適役割","strength":"この人の活かし方30文字以内"}],"strategy":"この組織の戦略・方針を一文","advice":"最重要改善アドバイスを一文"}\nrelationshipsは全メンバーの組み合わせを網羅。rolesは全員分。名前は必ず${JSON.stringify(allNames)}から使用。`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    res.json(parseJSON(content.text))
  } catch (err) {
    console.error('Organization error:', err)
    res.status(500).json({ error: '組織診断の生成に失敗しました' })
  }
})

// 結婚相性診断
analyzeRouter.post('/marriage', async (req, res) => {
  try {
    const { selfData, partnerData } = req.body
    const selfCtx   = buildPersonCtx(selfData,   { birthDate: selfData.birthDate,   gender: selfData.gender,   mbti: selfData.mbti   }, 'あなた')
    const partnerCtx = buildPersonCtx(partnerData, { birthDate: partnerData.birthDate, gender: partnerData.gender, mbti: partnerData.mbti }, 'お相手')

    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: '四柱推命・算命学・宿曜・納音を統合した結婚相性分析AIです。二人の命式から結婚生活・力関係・成功の鍵をJSONのみで返します。マークダウン・余分なテキスト禁止。',
      messages: [{
        role: 'user',
        content: `${selfCtx}\n${partnerCtx}\n\n以下のJSON形式のみで出力:\n{"overallScore":78,"marriageType":"この結婚の本質タイプ名（〜型）","lifeDescription":"結婚後の生活スタイルと雰囲気を具体的に100文字以内","powerDynamic":{"leader":"リードする側の名前","description":"力関係の詳細と変化のパターン80文字以内","balance":"対等|あなた主導|相手主導"},"successKeys":[{"key":"成功の鍵タイトル10文字以内","description":"具体的な実践方法50文字以内"}],"challenges":[{"issue":"課題タイトル","description":"課題の詳細と背景40文字以内","solution":"解決策40文字以内"}],"compatibility":{"daily":85,"crisis":70,"growth":80,"passion":75},"advice":"この二人への最重要メッセージ100文字以内"}\nsuccessKeys3つ、challenges2〜3つ。`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    res.json(parseJSON(content.text))
  } catch (err) {
    console.error('Marriage error:', err)
    res.status(500).json({ error: '結婚相性診断の生成に失敗しました' })
  }
})

// 採用・他己分析
analyzeRouter.post('/recruit', async (req, res) => {
  try {
    const { selfData, candidateData } = req.body
    const selfCtx      = buildPersonCtx(selfData,      { birthDate: selfData.birthDate,      gender: selfData.gender,      mbti: selfData.mbti      }, 'あなた（面接官）')
    const candidateCtx = buildPersonCtx(candidateData, { birthDate: candidateData.birthDate, gender: candidateData.gender, mbti: candidateData.mbti }, '候補者')

    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: '四柱推命・算命学・宿曜・納音を統合した採用・人材分析AIです。候補者の命式から強み・適性・面接官との相性をJSONのみで返します。マークダウン・余分なテキスト禁止。',
      messages: [{
        role: 'user',
        content: `${selfCtx}\n${candidateCtx}\n\n以下のJSON形式のみで出力:\n{"candidateType":"候補者のタイプ名","fitScore":82,"strengths":[{"name":"強みタイトル","score":88,"description":"この強みが仕事でどう現れるか50文字以内"}],"weaknesses":[{"name":"注意点","description":"注意が必要な場面40文字以内","mitigation":"マネジメントのコツ40文字以内"}],"workStyle":"この人の働き方・仕事スタイルを具体的に80文字以内","chemistryWithYou":{"score":75,"dynamic":"あなたとの関係性タイプ","description":"二人のシナジーと注意点60文字以内"},"interviewQuestions":["この命式から引き出すべき質問1","質問2","質問3"],"hiringAdvice":"採用判断のポイントと注意事項100文字以内"}\nstrengths4つ(score降順)、weaknesses2〜3つ、interviewQuestions3つ。`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    res.json(parseJSON(content.text))
  } catch (err) {
    console.error('Recruit error:', err)
    res.status(500).json({ error: '採用分析の生成に失敗しました' })
  }
})
