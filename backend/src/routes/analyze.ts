import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { requirePoints } from '../middleware/points.js'

export const analyzeRouter = Router()

// ─── インメモリキャッシュ（24時間TTL） ────────────────────────────────────
interface CacheEntry { data: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.data
}

function cacheSet(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

// ─── モデル選択（プレミアム → Sonnet / 一般 → Haiku） ────────────────────
function getModel(req: AuthRequest): string {
  return req.isPremium ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
}

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
  lifePathNumber?: number
  honmeiName?: string
  archetype?: string
  animalFortune?: string
  sukuyoDetail?: string
  daiyun?: string
  daiyunAge?: string
  ryunen?: string
}

function buildPersonCtx(p: PersonBlock, meta: { birthDate: string; gender: string }, label: string): string {
  const age = calcAge(meta.birthDate)
  const gender = meta.gender === 'male' ? '男性' : meta.gender === 'female' ? '女性' : '不明'
  const hourPart = p.shichu.hour ? `/時柱${p.shichu.hour.kanshi}(${p.shichu.hour.element}${p.shichu.hour.yinYang})` : ''
  const base = `【${label}】生年月日:${meta.birthDate}(${age}歳) 性別:${gender}`
    + ` 四柱推命:年柱${p.shichu.year.kanshi}(${p.shichu.year.element}${p.shichu.year.yinYang})/月柱${p.shichu.month.kanshi}(${p.shichu.month.element}${p.shichu.month.yinYang})/日柱${p.shichu.day.kanshi}(${p.shichu.day.element}${p.shichu.day.yinYang})${hourPart}`
    + ` 納音:${p.nayin} 宿命星:${p.sanmei.shukumeiStar} 天中殺:${p.sanmei.chusatsu} 宿曜:${p.sukuyo}宿`
  const extra: string[] = []
  if (p.lifePathNumber != null) extra.push(`数秘術(運命数):${p.lifePathNumber}`)
  if (p.honmeiName) extra.push(`九星気学(本命星):${p.honmeiName}`)
  if (p.daiyun) extra.push(`現在の大運:${p.daiyun}(${p.daiyunAge ?? ''})`)
  if (p.ryunen) extra.push(`今年の流年:${p.ryunen}`)
  const archetypePart = p.archetype ? `\n[日柱アーキタイプ参照(出力に名称不要)]:${p.archetype}` : ''
  const animalPart = p.animalFortune ? `\n[動物占い参照データ(アーキタイプの深化に使用)]:${p.animalFortune}` : ''
  const sukuyoPart = p.sukuyoDetail ? `\n[宿曜詳細]:${p.sukuyoDetail}` : ''
  return base + (extra.length ? ' ' + extra.join(' ') : '') + archetypePart + animalPart + sukuyoPart
}

// ─── 自己分析（3pt）─────────────────────────────────────────────────────────
analyzeRouter.post('/self', requireAuth, requirePoints(3), async (req: AuthRequest, res) => {
  try {
    const { fortuneData } = req.body
    console.log('[/self] Request received, fortuneData:', JSON.stringify(fortuneData, null, 2))

    if (!fortuneData) {
      throw new Error('fortuneData is missing')
    }

    const { input, shichu, nayin, sanmei, sukuyo, lifePathNumber, honmeiName, archetype, animalFortune, sukuyoDetail, daiyun, daiyunAge, ryunen } = fortuneData

    if (!input || !input.birthDate) {
      throw new Error('input.birthDate is missing')
    }

    const age = calcAge(input.birthDate)
    const currentYear = new Date().getFullYear()

    const cacheKey = `self_${input.birthDate}_${input.gender}`
    const cached = cacheGet(cacheKey)
    if (cached) {
      console.log('[/self] Cache hit for key:', cacheKey)
      res.json(cached)
      return
    }

    console.log('[/self] Building person context...')
    const ctx = buildPersonCtx({ shichu, nayin, sanmei, sukuyo, lifePathNumber, honmeiName, archetype, animalFortune, sukuyoDetail, daiyun, daiyunAge, ryunen }, input, 'あなた')

    const message = await getAnthropicClient().messages.create({
      model: getModel(req),
      max_tokens: 2500,
      system: `あなたは四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した最高峰の命理アナリストです。
四柱推命の日柱（命主）を分析の中心に置き、他の占術で補強します。
命式データから深く・具体的・断言調で分析し、結果をJSONのみで返します。
マークダウン・コードブロック・余分なテキストは一切禁止。
数値スコアは命式の特徴から論理的に算出し、表面的でなく命式の核心を突く記述をすること。
「〜でしょう」「〜かもしれません」は禁止。すべて断言調で書くこと。

【必須：分析の手順】
出力する前に、まず以下の手順で内部処理すること：
① 四柱推命（日柱）・動物占い（十二運星）・算命学（宿命星）・宿曜・納音・数秘術・九星気学の7つが、それぞれ何を示しているか列挙する
② 3つ以上の占術が共通して示すキーワード・特性を「コア特性」として特定する
③ コア特性を軸に据え、1〜2つしか出ない特性は補足として扱う
④ コア特性から断言調でJSON出力を生成する
この手順を踏まないと表面的な分析になるため、必ず実行すること。

【精度が高かった実例（参考）】
▼ 1985年6月6日生まれ・男性（動物占い:狼型・日柱:丙子・火陽・十二運星:胎）
共通コア:「外は明るい太陽（丙）、内は論理的で冷静（子）、孤独志向（調舒星・斗宿・狼）」→ 二面性・秘密主義・信頼した人だけに懐くが5つの占術で一致
強み:表舞台での存在感と信頼した人だけに深く懐く人間性・独自路線の実行力
弱み:二面性による誤解・一人で悩みを抱え込む・協調性が表面的に低く見られる

▼ 1995年3月16日生まれ・女性（動物占い:虎型・日柱:丙寅・火陽・十二運星:帝旺）
共通コア:「強烈な意志と頑固さ」「正義感・自分の基準を曲げない」「行動力・パワー」が5つの占術で一致
強み:やると決めたら最後までやり抜く・権力者にも物怖じしない正義感
弱み:頑固さで周囲と衝突・礼儀マナーへの厳しさで怖がられる`,
      messages: [{
        role: 'user',
        content: `${ctx}\n\n【現在年】${currentYear}年\n\n以下のJSON形式のみで出力（他のテキスト不要）:\n{"corePersonality":"本質タイプを一文（〜タイプ）命式の核心を突くこと","lifeTheme":"人生テーマをキャッチコピーで（数秘術・九星気学・宿曜を統合して）","strengths":[{"name":"強みの名前4〜8文字","score":88,"description":"この強みが現れる具体的な場面を60文字以内。命式の根拠を示す"}],"weaknesses":[{"name":"弱みの名前4〜8文字","description":"弱みの本質を50文字以内","advice":"命式に基づく具体的な改善ヒント60文字以内"}],"careers":[{"title":"職種・職業名","match":92,"reason":"命式から見たマッチする理由50文字以内"}],"turningPoints":[{"year":${currentYear},"age":${age},"theme":"転換期テーマ15文字以内","description":"大運・流年・宿曜を根拠とした詳細60文字以内","type":"opportunity"}]}\nstrengths5つ(score降順)、weaknesses3つ、careers5つ(match降順)、turningPoints直近6年(${currentYear}〜${currentYear + 5})を必ず含める。typeは"opportunity"|"challenge"|"transformation"のいずれか。年齢は生年月日を厳密に考慮して計算すること`,
      }],
    })

    console.log('[/self] AI analysis complete')
    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    const result = parseJSON(content.text)
    console.log('[/self] Parsed result:', result)
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('[/self] Error:', err)
    if (err instanceof Error) {
      console.error('[/self] Error stack:', err.stack)
    }
    const errorMessage = err instanceof Error ? err.message : '自己分析の生成に失敗しました'
    res.status(500).json({ error: errorMessage })
  }
})

// 相性鑑定は、保存済み自己鑑定と相手プロフィールを検証する
// /api/partners/:id/compatibility に一本化した。旧形式では生成しない。
analyzeRouter.post('/compatibility', requireAuth, (_req, res) => {
  res.status(410).json({
    code: 'COMPATIBILITY_ENDPOINT_MOVED',
    error: '相性鑑定は「ふたり」画面から作成してください。',
  })
})

// ─── 組織診断（3pt）─────────────────────────────────────────────────────────
analyzeRouter.post('/organization', requireAuth, requirePoints(3), async (req: AuthRequest, res) => {
  try {
    const { selfData, members } = req.body
    const selfCtx = buildPersonCtx(selfData, selfData.input, `${selfData.input.selfName || 'あなた'}`)
    const memberCtxs = members.map((m: PersonBlock & { name: string; birthDate: string; gender?: string }) =>
      buildPersonCtx(m, { birthDate: m.birthDate, gender: m.gender || 'unknown' }, m.name)
    ).join('\n')
    const allNames = [selfData.input.selfName || 'あなた', ...members.map((m: { name: string }) => m.name)]

    const message = await getAnthropicClient().messages.create({
      model: getModel(req),
      max_tokens: 2500,
      system: `四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した組織分析AIです。複数メンバーの命式から組織特性・人間関係・戦略をJSONのみで返します。マークダウン・余分なテキスト禁止。「〜でしょう」「〜かもしれません」禁止、断言調で書くこと。

【必須：分析の手順】
① 各メンバーのコア特性（複数占術が共通して示す特性）を先に特定する
② コア特性の組み合わせから組織全体のダイナミクスを把握する
③ 各メンバーのコア特性を最大限に活かす役割と戦略を断言する`,
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

// ─── 結婚相性診断（3pt）─────────────────────────────────────────────────────
analyzeRouter.post('/marriage', requireAuth, requirePoints(3), async (req: AuthRequest, res) => {
  try {
    const { selfData, partnerData } = req.body

    const cacheKey = `marriage_${selfData.birthDate}_${selfData.gender}_${partnerData.birthDate}_${partnerData.gender}`
    const cached = cacheGet(cacheKey)
    if (cached) { res.json(cached); return }

    const selfCtx   = buildPersonCtx(selfData,   { birthDate: selfData.birthDate,   gender: selfData.gender }, 'あなた')
    const partnerCtx = buildPersonCtx(partnerData, { birthDate: partnerData.birthDate, gender: partnerData.gender }, 'お相手')

    const message = await getAnthropicClient().messages.create({
      model: getModel(req),
      max_tokens: 2500,
      system: `四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した結婚相性分析AIです。
二人の命式から結婚生活・力関係・成功の鍵をJSONのみで返します。
マークダウン・余分なテキスト禁止。「〜でしょう」「〜かもしれません」禁止、断言調で書くこと。
日柱の干支の相性・天中殺の重なり・宿曜の安定性を中心に、結婚後の現実的な生活パターンを分析すること。

【必須：分析の手順】
① 各人物のコア特性（複数占術が共通して示す特性）を先に特定する
② 二人のコア特性が結婚生活でどう作用するかを具体的に想定する
③ 力関係・日常パターン・危機時の行動を命式から断言する`,
      messages: [{
        role: 'user',
        content: `${selfCtx}\n${partnerCtx}\n\n以下のJSON形式のみで出力:\n{"overallScore":78,"marriageType":"この結婚の本質タイプ名（〜型）命式の核心を突くこと","lifeDescription":"結婚後の生活スタイルと雰囲気を具体的かつ断言調で120文字以内","powerDynamic":{"leader":"リードする側の名前","description":"力関係の詳細・変化パターン・命式的根拠100文字以内","balance":"対等|あなた主導|相手主導"},"successKeys":[{"key":"成功の鍵タイトル10文字以内","description":"命式に基づく具体的な実践方法60文字以内"}],"challenges":[{"issue":"課題タイトル","description":"命式から見た課題の本質50文字以内","solution":"具体的解決策50文字以内"}],"compatibility":{"daily":85,"crisis":70,"growth":80,"passion":75},"advice":"この二人への最重要メッセージを断言調で120文字以内"}\nsuccessKeys3つ、challenges2〜3つ。`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    const result = parseJSON(content.text)
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Marriage error:', err)
    res.status(500).json({ error: '結婚相性診断の生成に失敗しました' })
  }
})

// ─── 採用・他己分析（3pt）───────────────────────────────────────────────────
analyzeRouter.post('/recruit', requireAuth, requirePoints(3), async (req: AuthRequest, res) => {
  try {
    const { selfData, candidateData } = req.body

    const cacheKey = `recruit_${selfData.birthDate}_${selfData.gender}_${candidateData.birthDate}_${candidateData.gender}`
    const cached = cacheGet(cacheKey)
    if (cached) { res.json(cached); return }

    const selfCtx      = buildPersonCtx(selfData,      { birthDate: selfData.birthDate,      gender: selfData.gender }, 'あなた（面接官）')
    const candidateCtx = buildPersonCtx(candidateData, { birthDate: candidateData.birthDate, gender: candidateData.gender }, '候補者')

    const message = await getAnthropicClient().messages.create({
      model: getModel(req),
      max_tokens: 2500,
      system: `四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した採用・人材分析AIです。
候補者の命式から強み・適性・面接官との相性をJSONのみで返します。
マークダウン・余分なテキスト禁止。「〜でしょう」「〜かもしれません」禁止、断言調で書くこと。
日柱アーキタイプ（十二運星）の特性を中心に、仕事上の行動パターンと組織での振る舞いを具体的に分析すること。

【必須：分析の手順】
① 候補者の複数占術が共通して示すコア特性（3つ以上一致するもの）を先に特定する
② そのコア特性が職場でどう現れるかを断言する
③ 表面的な特性ではなくコアから採用判断を下す`,
      messages: [{
        role: 'user',
        content: `${selfCtx}\n${candidateCtx}\n\n以下のJSON形式のみで出力:\n{"candidateType":"候補者の本質タイプ名（命式の核心を突く）","fitScore":82,"strengths":[{"name":"強みタイトル","score":88,"description":"この強みが仕事でどう現れるかを断言調で60文字以内"}],"weaknesses":[{"name":"注意点タイトル","description":"注意が必要な場面と命式的根拠50文字以内","mitigation":"具体的なマネジメントのコツ50文字以内"}],"workStyle":"この人の働き方・仕事スタイルを断言調で具体的に100文字以内","chemistryWithYou":{"score":75,"dynamic":"あなたとの関係性タイプ","description":"二人のシナジーと注意点を命式根拠で70文字以内"},"interviewQuestions":["この命式の特性を引き出す質問1","質問2","質問3"],"hiringAdvice":"採用判断のポイントと注意事項を断言調で120文字以内"}\nstrengths4つ(score降順)、weaknesses2〜3つ、interviewQuestions3つ。`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    const result = parseJSON(content.text)
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Recruit error:', err)
    res.status(500).json({ error: '採用分析の生成に失敗しました' })
  }
})

// ─── 上司占い（3pt）─────────────────────────────────────────────────────────
analyzeRouter.post('/boss', requireAuth, requirePoints(3), async (req: AuthRequest, res) => {
  try {
    const { selfData, bossData } = req.body

    const cacheKey = `boss_${selfData.birthDate}_${selfData.gender}_${bossData.birthDate}_${bossData.gender}`
    const cached = cacheGet(cacheKey)
    if (cached) { res.json(cached); return }

    const selfCtx = buildPersonCtx(selfData, { birthDate: selfData.birthDate, gender: selfData.gender }, 'あなた（部下）')
    const bossCtx = buildPersonCtx(bossData, { birthDate: bossData.birthDate, gender: bossData.gender }, '上司')

    const message = await getAnthropicClient().messages.create({
      model: getModel(req),
      max_tokens: 2500,
      system: `四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した上司分析AIです。
上司の命式から性格・価値観・コミュニケーションスタイルを分析し、良好な関係を築くためのアドバイスをJSONで返します。
マークダウン・余分なテキスト禁止。「〜でしょう」「〜かもしれません」禁止、断言調で書くこと。

【必須：分析の手順】
① 上司の複数占術が共通して示すコア特性を特定する
② その特性が職場でのリーダーシップスタイルにどう現れるかを断言する
③ あなたとの相性と効果的なコミュニケーション方法を具体的に示す`,
      messages: [{
        role: 'user',
        content: `${selfCtx}\n${bossCtx}\n\n以下のJSON形式のみで出力:\n{"bossType":"上司の本質タイプ名","leadershipStyle":"リーダーシップスタイルを断言調で80文字以内","values":["この上司が大切にする価値観1","価値観2","価値観3"],"preferredWords":["喜ぶ言葉・フレーズ1","言葉2","言葉3"],"ngWords":["避けるべき言葉・態度1","NG2"],"communicationTips":[{"situation":"報告時","advice":"具体的なコツ60文字以内"},{"situation":"相談時","advice":"60文字以内"},{"situation":"依頼時","advice":"60文字以内"}],"chemistryWithYou":{"score":75,"description":"あなたとの相性と関係性の特徴80文字以内"},"monthlyStrategy":"今月の接し方・注意点を80文字以内"}\nvalues3つ、preferredWords3〜4つ、ngWords2〜3つ、communicationTips3つ。`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    const result = parseJSON(content.text)
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Boss error:', err)
    res.status(500).json({ error: '上司分析の生成に失敗しました' })
  }
})

// ─── 部下占い（3pt）─────────────────────────────────────────────────────────
analyzeRouter.post('/subordinate', requireAuth, requirePoints(3), async (req: AuthRequest, res) => {
  try {
    const { selfData, subordinateData } = req.body

    const cacheKey = `subordinate_${selfData.birthDate}_${selfData.gender}_${subordinateData.birthDate}_${subordinateData.gender}`
    const cached = cacheGet(cacheKey)
    if (cached) { res.json(cached); return }

    const selfCtx        = buildPersonCtx(selfData,        { birthDate: selfData.birthDate,        gender: selfData.gender }, 'あなた（上司）')
    const subordinateCtx = buildPersonCtx(subordinateData, { birthDate: subordinateData.birthDate, gender: subordinateData.gender }, '部下')

    const message = await getAnthropicClient().messages.create({
      model: getModel(req),
      max_tokens: 2500,
      system: `四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した部下分析AIです。
部下の命式から性格・モチベーション・成長ポイントを分析し、効果的なマネジメント方法をJSONで返します。
マークダウン・余分なテキスト禁止。「〜でしょう」「〜かもしれません」禁止、断言調で書くこと。

【必須：分析の手順】
① 部下の複数占術が共通して示すコア特性を特定する
② その特性が仕事へのモチベーションや成長パターンにどう影響するかを断言する
③ あなたとの相性と効果的なマネジメント方法を具体的に示す`,
      messages: [{
        role: 'user',
        content: `${selfCtx}\n${subordinateCtx}\n\n以下のJSON形式のみで出力:\n{"subordinateType":"部下の本質タイプ名","workStyle":"仕事への取り組み方を断言調で80文字以内","motivators":["モチベーションの源泉1","源泉2","源泉3"],"strengths":[{"name":"強みタイトル","description":"職場でどう活かすか50文字以内"}],"growthAreas":[{"area":"成長が必要な領域","approach":"育成アプローチ60文字以内"}],"managementTips":[{"situation":"指示出し時","advice":"効果的な伝え方60文字以内"},{"situation":"フィードバック時","advice":"60文字以内"},{"situation":"育成時","advice":"60文字以内"}],"chemistryWithYou":{"score":72,"description":"あなたとの相性と関係性80文字以内"},"caution":"マネジメント上の最重要注意点を80文字以内"}\nmotivators3つ、strengths3つ、growthAreas2〜3つ、managementTips3つ。`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    const result = parseJSON(content.text)
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Subordinate error:', err)
    res.status(500).json({ error: '部下分析の生成に失敗しました' })
  }
})

// ─── 取引先占い（3pt）───────────────────────────────────────────────────────
analyzeRouter.post('/client', requireAuth, requirePoints(3), async (req: AuthRequest, res) => {
  try {
    const { selfData, clientData } = req.body

    const cacheKey = `client_${selfData.birthDate}_${selfData.gender}_${clientData.birthDate}_${clientData.gender}`
    const cached = cacheGet(cacheKey)
    if (cached) { res.json(cached); return }

    const selfCtx   = buildPersonCtx(selfData,   { birthDate: selfData.birthDate,   gender: selfData.gender }, 'あなた')
    const clientCtx = buildPersonCtx(clientData, { birthDate: clientData.birthDate, gender: clientData.gender }, '取引先担当者')

    const message = await getAnthropicClient().messages.create({
      model: getModel(req),
      max_tokens: 2500,
      system: `四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した取引先分析AIです。
取引先担当者の命式から性格・意思決定スタイル・信頼構築ポイントを分析し、良好な関係を築くためのアドバイスをJSONで返します。
マークダウン・余分なテキスト禁止。「〜でしょう」「〜かもしれません」禁止、断言調で書くこと。

【必須：分析の手順】
① 取引先担当者の複数占術が共通して示すコア特性を特定する
② その特性がビジネス判断や人間関係にどう影響するかを断言する
③ あなたとの相性と効果的なアプローチ方法を具体的に示す`,
      messages: [{
        role: 'user',
        content: `${selfCtx}\n${clientCtx}\n\n以下のJSON形式のみで出力:\n{"clientType":"取引先担当者の本質タイプ名","decisionStyle":"意思決定スタイルを断言調で80文字以内","trustFactors":["信頼を得るポイント1","ポイント2","ポイント3"],"communicationPreferences":[{"channel":"対面・メール・電話など","style":"好まれるコミュニケーション方法50文字以内"}],"approachStrategies":[{"phase":"初回接触","strategy":"効果的なアプローチ60文字以内"},{"phase":"提案時","strategy":"60文字以内"},{"phase":"交渉時","strategy":"60文字以内"}],"taboos":["避けるべき行動・態度1","タブー2"],"chemistryWithYou":{"score":78,"description":"あなたとの相性とシナジー80文字以内"},"nextAction":"次に取るべき具体的行動を80文字以内"}\ntrustFactors3つ、communicationPreferences2〜3つ、approachStrategies3つ、taboos2〜3つ。`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    const result = parseJSON(content.text)
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Client error:', err)
    res.status(500).json({ error: '取引先分析の生成に失敗しました' })
  }
})

// ─── 方位診断（2pt）─────────────────────────────────────────────────────────
analyzeRouter.post('/direction', requireAuth, requirePoints(2), async (req: AuthRequest, res) => {
  try {
    const { fortuneData } = req.body
    const { input, shichu, nayin, sanmei, sukuyo, honmeiName } = fortuneData

    if (!input || !input.birthDate) throw new Error('input.birthDate is missing')

    const currentYear = new Date().getFullYear()
    const cacheKey = `direction_${input.birthDate}_${input.gender}_${currentYear}`
    const cached = cacheGet(cacheKey)
    if (cached) { res.json(cached); return }

    const ctx = buildPersonCtx({ shichu, nayin, sanmei, sukuyo, honmeiName }, input, 'あなた')

    const message = await getAnthropicClient().messages.create({
      model: getModel(req),
      max_tokens: 2000,
      system: `四柱推命・算命学・宿曜・九星気学を統合した方位診断AIです。
命式と九星気学から吉方位・凶方位を分析し、具体的な活用アドバイスをJSONで返します。
マークダウン・余分なテキスト禁止。「〜でしょう」「〜かもしれません」禁止、断言調で書くこと。

【必須：分析の手順】
① 九星気学の本命星から今年の吉方位・凶方位を特定する
② 四柱推命の五行バランスから補うべき方位エネルギーを判断する
③ 具体的な活用方法を断言調で示す`,
      messages: [{
        role: 'user',
        content: `${ctx}\n\n【現在年】${currentYear}年\n\n以下のJSON形式のみで出力:\n{"luckyDirections":[{"direction":"北・南・東・西・北東・南東・南西・北西","effect":"吉方位の効果50文字以内","usage":"具体的な活用方法60文字以内"}],"unluckyDirections":[{"direction":"方位名","reason":"凶方位の理由40文字以内","mitigation":"対策方法50文字以内"}],"monthlyBest":"今月の最吉方位と活用タイミング80文字以内","relocationAdvice":"引越し・移転に関するアドバイス80文字以内","travelTips":"出張・旅行の方位選び60文字以内","officeLayout":"オフィス・自宅でのデスク配置アドバイス80文字以内"}\nluckyDirections2〜3つ、unluckyDirections1〜2つ。`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    const result = parseJSON(content.text)
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Direction error:', err)
    res.status(500).json({ error: '方位診断の生成に失敗しました' })
  }
})

// ─── 自由鑑定（3pt）─────────────────────────────────────────────────────────
analyzeRouter.post('/free', requireAuth, requirePoints(3), async (req: AuthRequest, res) => {
  try {
    const { fortuneData, question, partnerBirthDate, partnerGender } = req.body
    if (!fortuneData?.input?.birthDate) throw new Error('fortuneData is missing')

    const { input, shichu, nayin, sanmei, sukuyo, lifePathNumber, honmeiName, archetype, animalFortune, sukuyoDetail, daiyun, daiyunAge, ryunen } = fortuneData
    const currentYear = new Date().getFullYear()

    const cacheKey = `free_${input.birthDate}_${input.gender}_${question ?? ''}_${partnerBirthDate ?? ''}`
    const cached = cacheGet(cacheKey)
    if (cached) { res.json(cached); return }

    const selfCtx = buildPersonCtx({ shichu, nayin, sanmei, sukuyo, lifePathNumber, honmeiName, archetype, animalFortune, sukuyoDetail, daiyun, daiyunAge, ryunen }, input, 'あなた')

    let partnerCtx = ''
    if (partnerBirthDate) {
      partnerCtx = `\n【相手】生年月日:${partnerBirthDate} 性別:${partnerGender === 'female' ? '女性' : '男性'}`
    }

    const userPrompt = question
      ? `${selfCtx}${partnerCtx}\n\n【現在年】${currentYear}年\n\n【質問】${question}\n\n上記の命式データをもとに、質問に対して詳細に答えてください。`
      : `${selfCtx}\n\n【現在年】${currentYear}年\n\n命式データをもとに、この人物の特性・強み・人生傾向について詳しく解析してください。`

    const message = await getAnthropicClient().messages.create({
      model: getModel(req),
      max_tokens: 2500,
      system: `あなたは四柱推命・算命学・宿曜・納音・数秘術・九星気学を統合した最高峰の命理アナリストです。
命式データをもとに、ユーザーの質問に対して深く・具体的・断言調で回答します。
マークダウンは使わず、自然な日本語の文章で答えてください。重要なポイントは**太字**で強調してください。`,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Invalid response type')
    const result = { answer: content.text }
    cacheSet(cacheKey, result)
    res.json(result)
  } catch (err) {
    console.error('Free analyze error:', err)
    res.status(500).json({ error: '解析に失敗しました' })
  }
})
