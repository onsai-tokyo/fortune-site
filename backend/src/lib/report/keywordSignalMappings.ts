/**
 * 占術別 axis / signal マッピング表
 *
 * PR-2a-2: factsV2.ts の keywordSignal()（6分岐の正規表現 + 既定 independence）を置き換える。
 *
 * 【重要】
 * - キーは一般的な日本語表記に統一している。
 *   PR-2a-3 で divination/index.ts の NAYIN と deterministicReport.ts の NAYIN_DETAIL を
 *   同じ表記へ揃えること。旧表記は NAYIN_ALIAS で吸収する。
 * - 宿曜は単字（婁 / 胃 / 昴 …）が内部値。表示時にのみ「宿」を付ける。
 * - 紫微斗数は完全一致を先に試し、失敗した場合だけ末尾の「星」を除去する。
 * - signal は editorial.ts の signalLanguage に存在する18キーのみを使う。新規キーは追加しない。
 * - axis は facts.ts の FactAxis のみを使う。
 * - strength は 0.4〜1.0。「その名称がどれだけ特徴的か」を表す。
 *   万人に当てはまる一般的な性質ほど低く、限定的で個人差が出るものほど高い。
 * - 表に無いキーは resolveSignal() が null を返す。呼び出し側で Fact を発行しないこと。
 *   ★ independence へフォールバックしない。これが PR-2a-2 の目的である。
 *
 * 【出典】
 * - 納音30種: 六十花甲子納音の五行と字義
 * - 宿曜27宿: 宿曜経の各宿の性質
 * - ナクシャトラ27種: ヴェーダ占星術の各ナクシャトラの象意
 * - 紫微斗数の主星14種: ziwei.ts の STAR_DETAIL の記述をそのまま axis/signal へ翻訳
 * - 紫微斗数の副星: 各星の一般的な象意
 */

import type { FactAxis } from './facts.js'

export interface SignalMapping {
  axis: FactAxis
  signal: string
  strength: number
}

/** editorial.ts の signalLanguage に存在する18キー。これ以外を使わないこと。 */
export const ALLOWED_SIGNALS = [
  'independence', 'competition', 'expression', 'critique', 'adaptability',
  'practicality', 'initiative', 'responsibility', 'insight', 'learning',
  'harmony', 'sensitivity', 'care', 'stability', 'exploration',
  'communication', 'transformation', 'integration',
] as const

// ============================================================================
// 納音 30種（60干支 → 30名称。1名称が2つの干支をカバーする）
// ============================================================================

export const NAYIN_MAPPING: Record<string, SignalMapping> = {
  // ── 金：切り分け・決断・硬さ
  海中金: { axis: 'cognition', signal: 'insight',        strength: 0.75 }, // 海に沈む金。内に秘めた判断力
  剣鋒金: { axis: 'drive',     signal: 'critique',       strength: 0.90 }, // 剣の刃。鋭い切り分け
  白鑞金: { axis: 'expression', signal: 'expression',    strength: 0.65 }, // 装飾の金。整った見せ方
  沙中金: { axis: 'cognition', signal: 'insight',        strength: 0.70 }, // 砂に埋もれた金。見出される才
  金箔金: { axis: 'expression', signal: 'expression',    strength: 0.65 }, // 薄い箔。外面の華やかさ
  釵釧金: { axis: 'relation',  signal: 'harmony',        strength: 0.60 }, // 装身具の金。人との調和

  // ── 木：成長・伸長・柔軟
  大林木: { axis: 'drive',     signal: 'stability',      strength: 0.75 }, // 大森林。長期の育成
  楊柳木: { axis: 'cognition', signal: 'adaptability',   strength: 0.80 }, // 柳。しなやかに受け流す
  松柏木: { axis: 'drive',     signal: 'stability',      strength: 0.85 }, // 松柏。変わらぬ節操
  平地木: { axis: 'relation',  signal: 'care',           strength: 0.60 }, // 平地の木。周囲との共生
  桑柘木: { axis: 'domain-work', signal: 'practicality', strength: 0.70 }, // 桑。実利へ結びつく育成
  石榴木: { axis: 'expression', signal: 'expression',    strength: 0.70 }, // 石榴。内に多くを抱えて実る

  // ── 水：流動・感受・浸透
  澗下水: { axis: 'relation',  signal: 'sensitivity',    strength: 0.75 }, // 谷川。細く確かに流れる
  井泉水: { axis: 'cognition', signal: 'insight',        strength: 0.75 }, // 泉。内から湧く洞察
  長流水: { axis: 'drive',     signal: 'stability',      strength: 0.70 }, // 長流。継続の力
  天河水: { axis: 'cognition', signal: 'exploration',    strength: 0.80 }, // 天の川。遠くを見る想像
  大渓水: { axis: 'drive',     signal: 'transformation', strength: 0.75 }, // 渓流。勢いのある変化
  大海水: { axis: 'relation',  signal: 'integration',    strength: 0.85 }, // 大海。すべてを受け入れる

  // ── 火：発信・情熱・照射
  炉中火: { axis: 'domain-work', signal: 'practicality', strength: 0.75 }, // 炉の火。用途の定まった熱
  山頭火: { axis: 'expression', signal: 'initiative',    strength: 0.80 }, // 山頂の火。遠くまで届く発信
  霹靂火: { axis: 'drive',     signal: 'transformation', strength: 0.90 }, // 雷。突発的で強い転換
  山下火: { axis: 'relation',  signal: 'care',           strength: 0.60 }, // 麓の火。身近を温める
  覆燈火: { axis: 'cognition', signal: 'insight',        strength: 0.70 }, // 覆いのある灯。内向きの照らし
  天上火: { axis: 'expression', signal: 'expression',    strength: 0.85 }, // 太陽。公然と照らす

  // ── 土：安定・受容・基盤
  路傍土: { axis: 'relation',  signal: 'communication',  strength: 0.65 }, // 道端の土。人の往来を支える
  城頭土: { axis: 'drive',     signal: 'responsibility', strength: 0.80 }, // 城壁。守るべき境界
  屋上土: { axis: 'relation',  signal: 'care',           strength: 0.70 }, // 屋根の土。他者を覆い守る
  壁上土: { axis: 'drive',     signal: 'stability',      strength: 0.70 }, // 壁の土。仕切りと保持
  大駅土: { axis: 'relation',  signal: 'communication',  strength: 0.80 }, // 大きな駅。人と情報の結節点
  沙中土: { axis: 'cognition', signal: 'adaptability',   strength: 0.65 }, // 砂の土。形を変え続ける
}

/**
 * 旧表記からの読み替え。
 * 保存済みの calculated_data.nayin には旧表記が入っているため、
 * resolveNayin() は必ずこの表を通してから引くこと。
 */
export const NAYIN_ALIAS: Record<string, string> = {
  路旁土: '路傍土',   // 旁 → 傍
  涧下水: '澗下水',   // 涧 は簡体字
  白蜡金: '白鑞金',   // 蜡 は簡体字
  泉中水: '井泉水',   // 一般的な名称へ
  砂中金: '沙中金',   // 沙中土 と字を揃える
  大溪水: '大渓水',   // 溪 は異体字
}

// ============================================================================
// 宿曜 27宿
//
// 内部値は単字（婁 / 胃 / 昴 …）。SUKUYO_ORDER と SUKUYO_DETAIL のキーはどちらも単字で一致している。
// 「宿」は表示時にのみ付与される（chartSections.ts:81 / deterministicReport.ts:618）。
// resolveSukuyo() は防御的に末尾の「宿」を除去してから引く。
// ============================================================================

export const SUKUYO_MAPPING: Record<string, SignalMapping> = {
  婁: { axis: 'relation',    signal: 'care',           strength: 0.75 }, // 世話好き。面倒を見る
  胃: { axis: 'domain-work', signal: 'practicality',   strength: 0.75 }, // 現実的。蓄えを守る
  昴: { axis: 'drive',       signal: 'independence',   strength: 0.85 }, // 独立心。単独で立つ
  畢: { axis: 'drive',       signal: 'stability',      strength: 0.80 }, // 堅実。着実に積む
  觜: { axis: 'cognition',   signal: 'exploration',    strength: 0.75 }, // 好奇心。次々に関心が移る
  参: { axis: 'drive',       signal: 'initiative',     strength: 0.80 }, // 行動。まず動く
  井: { axis: 'expression',  signal: 'communication',  strength: 0.80 }, // 社交。人を集める
  鬼: { axis: 'relation',    signal: 'responsibility', strength: 0.85 }, // 誠実。守るべきものを守る
  柳: { axis: 'relation',    signal: 'sensitivity',    strength: 0.85 }, // 感受鋭敏。細部に気づく
  星: { axis: 'expression',  signal: 'expression',     strength: 0.85 }, // 華やか。目を引く
  張: { axis: 'drive',       signal: 'competition',    strength: 0.80 }, // 情熱。主張し押し出す
  翼: { axis: 'expression',  signal: 'expression',     strength: 0.80 }, // 独創。独自の表現
  軫: { axis: 'drive',       signal: 'responsibility', strength: 0.80 }, // 統率。まとめて率いる
  角: { axis: 'expression',  signal: 'harmony',        strength: 0.75 }, // 社交巧み。場を整える
  亢: { axis: 'cognition',   signal: 'critique',       strength: 0.85 }, // 探究。納得するまで問う
  氐: { axis: 'relation',    signal: 'initiative',     strength: 0.70 }, // 直情。感情がそのまま出る
  房: { axis: 'drive',       signal: 'responsibility', strength: 0.80 }, // 高潔。原則を持って導く
  心: { axis: 'cognition',   signal: 'insight',        strength: 0.85 }, // 直感。先に感じ取る
  尾: { axis: 'drive',       signal: 'stability',      strength: 0.80 }, // 忍耐。時間をかけて蓄える
  箕: { axis: 'cognition',   signal: 'adaptability',   strength: 0.85 }, // 変化と自由。型に収まらない
  斗: { axis: 'relation',    signal: 'harmony',        strength: 0.75 }, // 誠実温和。角を立てない
  女: { axis: 'cognition',   signal: 'insight',        strength: 0.80 }, // 内向的探究。内側で深める
  虚: { axis: 'cognition',   signal: 'insight',        strength: 0.85 }, // 洞察。本質を見抜く
  危: { axis: 'drive',       signal: 'exploration',    strength: 0.85 }, // 冒険。危うさを厭わない
  室: { axis: 'drive',       signal: 'initiative',     strength: 0.80 }, // 積極的指導。前に出る
  壁: { axis: 'relation',    signal: 'care',           strength: 0.80 }, // 誠実奉仕。人のために動く
  奎: { axis: 'relation',    signal: 'care',           strength: 0.75 }, // 慈愛。広く受け入れる
}

// ============================================================================
// ナクシャトラ 27種
// キーは astrology.ts の NAKSHATRAS 配列の表記に完全一致させている
// ============================================================================

export const NAKSHATRA_MAPPING: Record<string, SignalMapping> = {
  アシュヴィニー:            { axis: 'drive',       signal: 'initiative',     strength: 0.85 }, // 迅速な始動
  バラニー:                  { axis: 'drive',       signal: 'transformation', strength: 0.80 }, // 抱え込み、変える
  クリッティカー:            { axis: 'cognition',   signal: 'critique',       strength: 0.85 }, // 鋭く切り分ける
  ローヒニー:                { axis: 'expression',  signal: 'expression',     strength: 0.85 }, // 魅力と実り
  ムリガシーラ:              { axis: 'cognition',   signal: 'exploration',    strength: 0.85 }, // 探し求める
  アールドラー:              { axis: 'drive',       signal: 'transformation', strength: 0.85 }, // 嵐。既存を壊す
  プナルヴァス:              { axis: 'cognition',   signal: 'adaptability',   strength: 0.75 }, // 回復と再生
  プシャ:                    { axis: 'relation',    signal: 'care',           strength: 0.85 }, // 養い育てる
  アーシュレーシャ:          { axis: 'cognition',   signal: 'insight',        strength: 0.85 }, // 見抜く、絡め取る
  マガー:                    { axis: 'drive',       signal: 'responsibility', strength: 0.85 }, // 継承と威厳
  'プールヴァ・パールグニー': { axis: 'relation',    signal: 'harmony',        strength: 0.80 }, // 享楽と交歓
  'ウッタラ・パールグニー':   { axis: 'relation',    signal: 'responsibility', strength: 0.80 }, // 契約と支援
  ハスタ:                    { axis: 'domain-work', signal: 'practicality',   strength: 0.85 }, // 手仕事。形にする
  チトラー:                  { axis: 'expression',  signal: 'expression',     strength: 0.85 }, // 意匠と輝き
  スヴァーティ:              { axis: 'drive',       signal: 'independence',   strength: 0.85 }, // 独立。風のように動く
  ヴィシャーカー:            { axis: 'drive',       signal: 'competition',    strength: 0.85 }, // 目標への集中
  アヌラーダー:              { axis: 'relation',    signal: 'harmony',        strength: 0.80 }, // friendship と協力
  ジェーシュタ:              { axis: 'drive',       signal: 'competition',    strength: 0.80 }, // 序列と主導
  ムーラ:                    { axis: 'cognition',   signal: 'insight',        strength: 0.85 }, // 根を掘る
  'プールヴァ・アーシャーダー': { axis: 'expression', signal: 'initiative',    strength: 0.80 }, // 不屈の宣言
  'ウッタラ・アーシャーダー':   { axis: 'drive',      signal: 'stability',     strength: 0.80 }, // 揺るがぬ勝利
  シュラヴァナ:              { axis: 'cognition',   signal: 'learning',       strength: 0.85 }, // 聴き、学ぶ
  ダニシュター:              { axis: 'expression',  signal: 'communication',  strength: 0.80 }, // 音と集団
  シャタビシャー:            { axis: 'cognition',   signal: 'insight',        strength: 0.85 }, // 秘めた治癒と探究
  'プールヴァ・バードラパダー': { axis: 'drive',      signal: 'transformation', strength: 0.80 }, // 激しい転換
  'ウッタラ・バードラパダー':   { axis: 'relation',   signal: 'stability',     strength: 0.80 }, // 深く静かな安定
  レーヴァティー:            { axis: 'relation',    signal: 'sensitivity',    strength: 0.85 }, // 導きと共感
}

// ============================================================================
// 紫微斗数 主星 14種
// ziwei.ts の STAR_DETAIL の記述をそのまま axis / signal へ翻訳している
// ============================================================================

export const ZIWEI_MAJOR_MAPPING: Record<string, SignalMapping> = {
  紫微: { axis: 'drive',       signal: 'responsibility', strength: 0.95 }, // 統率、尊厳、全体をまとめる力
  天機: { axis: 'cognition',   signal: 'adaptability',   strength: 0.85 }, // 思考、企画、変化への対応力
  太陽: { axis: 'expression',  signal: 'initiative',     strength: 0.90 }, // 発信、行動力、社会への貢献
  武曲: { axis: 'domain-work', signal: 'practicality',   strength: 0.90 }, // 実務、決断、財務感覚
  天同: { axis: 'relation',    signal: 'harmony',        strength: 0.80 }, // 調和、受容、生活を楽しむ力
  廉貞: { axis: 'tension',     signal: 'transformation', strength: 0.85 }, // 情熱、規律、複雑な状況を扱う力
  天府: { axis: 'drive',       signal: 'stability',      strength: 0.85 }, // 安定、管理、資源を蓄える力
  太陰: { axis: 'relation',    signal: 'sensitivity',    strength: 0.90 }, // 感受性、内面、蓄積と配慮
  貪狼: { axis: 'expression',  signal: 'exploration',    strength: 0.90 }, // 社交性、欲求、才芸と展開力
  巨門: { axis: 'cognition',   signal: 'critique',       strength: 0.90 }, // 言葉、分析、疑問を深める力
  天相: { axis: 'relation',    signal: 'care',           strength: 0.80 }, // 調整、公平性、支援と品位
  天梁: { axis: 'relation',    signal: 'responsibility', strength: 0.85 }, // 保護、原則、経験から人を導く力
  七殺: { axis: 'drive',       signal: 'initiative',     strength: 0.95 }, // 突破、決断、緊張下での実行力
  破軍: { axis: 'drive',       signal: 'transformation', strength: 0.95 }, // 刷新、破壊と再構築、大きな転換力
}

// ============================================================================
// 紫微斗数 副星
// 主星より strength を全体的に低くする（副星は補助的な性質を示すため）
// ============================================================================

export const ZIWEI_MINOR_MAPPING: Record<string, SignalMapping> = {
  // ── 文星：学び・表現
  文昌: { axis: 'cognition',   signal: 'learning',       strength: 0.60 },
  文曲: { axis: 'expression',  signal: 'expression',     strength: 0.60 },

  // ── 輔弼：支援
  左輔: { axis: 'relation',    signal: 'care',           strength: 0.55 },
  右弼: { axis: 'relation',    signal: 'care',           strength: 0.55 },
  天魁: { axis: 'relation',    signal: 'harmony',        strength: 0.55 },
  天鉞: { axis: 'relation',    signal: 'harmony',        strength: 0.55 },

  // ── 煞星：摩擦・緊張（axis は shadow / tension）
  火星: { axis: 'shadow',      signal: 'initiative',     strength: 0.65 },
  鈴星: { axis: 'shadow',      signal: 'transformation', strength: 0.65 },
  擎羊: { axis: 'shadow',      signal: 'critique',       strength: 0.70 },
  陀羅: { axis: 'shadow',      signal: 'stability',      strength: 0.65 },
  地空: { axis: 'deficit',     signal: 'exploration',    strength: 0.70 },
  地劫: { axis: 'deficit',     signal: 'transformation', strength: 0.70 },

  // ── 財禄
  禄存: { axis: 'domain-work', signal: 'practicality',   strength: 0.70 },
  天馬: { axis: 'drive',       signal: 'adaptability',   strength: 0.65 },

  // ── 桃花星：恋愛領域
  紅鸞: { axis: 'domain-love', signal: 'harmony',        strength: 0.75 },
  天喜: { axis: 'domain-love', signal: 'harmony',        strength: 0.70 },
  天姚: { axis: 'domain-love', signal: 'expression',     strength: 0.70 },
  咸池: { axis: 'domain-love', signal: 'sensitivity',    strength: 0.70 },

  // ── その他
  天刑: { axis: 'shadow',      signal: 'responsibility', strength: 0.60 },
  天巫: { axis: 'cognition',   signal: 'insight',        strength: 0.55 },
  天哭: { axis: 'shadow',      signal: 'sensitivity',    strength: 0.55 },
  天虚: { axis: 'deficit',     signal: 'stability',      strength: 0.55 },
  孤辰: { axis: 'relation',    signal: 'independence',   strength: 0.60 },
  寡宿: { axis: 'relation',    signal: 'independence',   strength: 0.60 },
}

// ============================================================================
// 解決関数
// ============================================================================

/** 宿曜の内部表記を単字へ統一する。 */
export function normalizeSukuyo(value: string): string {
  return value.trim().replace(/宿$/, '')
}

export function resolveNayin(value: string): SignalMapping | null {
  const raw = value.trim()
  const name = NAYIN_ALIAS[raw] ?? raw
  return NAYIN_MAPPING[name] ?? null
}

export function resolveSukuyo(value: string): SignalMapping | null {
  return SUKUYO_MAPPING[normalizeSukuyo(value)] ?? null
}

export function resolveNakshatra(value: string): SignalMapping | null {
  return NAKSHATRA_MAPPING[value.trim()] ?? null
}

export function resolveZiweiStar(value: string): SignalMapping | null {
  const raw = value.trim().replace(/祿/g, '禄')
  if (ZIWEI_MAJOR_MAPPING[raw]) return ZIWEI_MAJOR_MAPPING[raw]
  if (ZIWEI_MINOR_MAPPING[raw]) return ZIWEI_MINOR_MAPPING[raw]
  const stripped = raw.replace(/星$/, '')
  return ZIWEI_MAJOR_MAPPING[stripped] ?? ZIWEI_MINOR_MAPPING[stripped] ?? null
}

/**
 * 未知の名称を検出するためのログ。
 * 分布テストで unmatched が出たら、表に追加するか表記を確認すること。
 * ★ 既定値へフォールバックしないこと。
 */
export function logUnmatched(kind: string, value: string): void {
  console.warn('Signal mapping unmatched', { kind, value })
}
