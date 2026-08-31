/**
 * 時期の流れ（年カード）の文章資産 — 型定義。
 *
 * 【Phase 1 で直したこと】
 *  1. TimingMatch の history が2回定義されていてコンパイルできなかった
 *  2. 条件を readonly string[] で持っていたため 'medium_or_high' / 'very_high' が
 *     文字列のまま残り、レンダラの LEVELS.get(want, 2) で全部 high 扱いになっていた
 *  3. 'x:low' が level >= 0 と解釈され、スコアが high の年でも成立していた
 *     （relationship_binding:low を使う9件が、Binding の高い年にも出ていた）
 *  4. coEvents に存在しないイベント 'study_or_move' が入っていた
 *  5. 未定義キー career_change_or_expansion が通常条件に残っていた
 *
 * 条件はすべて型付きオブジェクトへ移し、文字列解釈をやめた。
 */

import type { LifeEventKey } from './lifeEventLabels.js'

/** 占いロジック文書 §49 の18スコア */
export const TIMING_SCORE_KEYS = [
  'relationship_activation', 'relationship_binding', 'relationship_disruption',
  'relationship_secrecy', 'relationship_idealization', 'marriage_legalization',
  'career_activation', 'career_change', 'career_expansion', 'money_status',
  'home_family', 'relocation', 'education_activation', 'education_disruption',
  'identity_reset', 'social_network_change', 'responsibility', 'emotional_stress',
] as const
export type TimingScoreKey = typeof TIMING_SCORE_KEYS[number]

/** 性格・恋愛文書の71スコアのうち、時期条件で使われるもの */
export const TRAIT_GATE_KEYS = [
  'social_conformity', 'plan_orientation', 'romantic_absorption', 'career_absorption',
  'private_introversion', 'emotional_volatility', 'relationship_boundary_strength',
  'tolerance', 'partner_mirroring', 'approval_need', 'pride_sensitivity', 'effort_respect',
  'novelty_attraction', 'friendship_orientation', 'status_attraction', 'respect_attraction',
  'age_gap_attraction', 'authority_attraction', 'emotional_expression',
  'recognition_motivation', 'practical_generosity', 'stability_preference',
  'immersion_intensity', 'social_extraversion', 'family_orientation', 'domestic_affection',
  'life_stage_alignment', 'friendship_independence', 'lifestyle_adaptability',
  'group_coordination', 'intellectual_attraction', 'conversation_entertainment',
  'self_complexity', 'loneliness_tendency', 'social_sensitivity', 'private_assertiveness',
  'public_agreeableness', 'social_neutrality', 'neutrality_pride', 'reliability_preference',
  'charisma_attraction', 'gossip_curiosity', 'taboo_curiosity', 'playfulness',
  'friendship_value_match', 'social_network_change',
] as const
export type TraitGateKey = typeof TRAIT_GATE_KEYS[number]

export const RELATIONSHIP_STATUSES = ['single', 'dating', 'cohabiting', 'married', 'unknown'] as const
export type RelationshipStatus = typeof RELATIONSHIP_STATUSES[number]

export const HISTORY_KEYS = [
  'past_serious_relationship', 'marriage', 'divorce',
  'past_job_change', 'past_role_change', 'past_education_setback', 'past_long_contract',
] as const
export type HistoryKey = typeof HISTORY_KEYS[number]

/** Phase 3ではResolver未実装。値域は実測とResolver設計が完了するまで固定しない。 */
export type WorkStatus = string

export type TimingRuntimeContextValue = string | number | boolean
export type TimingRuntimeContext = Readonly<Record<string, TimingRuntimeContextValue>>

/**
 * ★未定義キー。18スコアにも71スコアにも存在しない。
 * 実装が決まるまで通常条件として評価しないこと。
 * ★seed_signal は Phase 1b で削除した。events に seed がある時点で成立しており、
 *   イベントから導いた結果を再び条件に使う循環だったため。
 * ★autonomy_need は Phase 2b で分解した。
 *   wk-05 → 既存71スコア（stability_preference / private_assertiveness）へ接続し enabled
 *   wk-15 → work_autonomy_need（新規 Derived Trait）。disabled 維持
 * ★verbal_processing は Phase 2b で分解した。既存71スコアへマッピングしない。
 *   conversation_entertainment は会話のテンポ、emotional_expression は感情の出し方であり、
 *   いずれも「学習時の言語化スタイル」ではない。
 *   st-03 → learning_by_explaining（新規 Derived Trait）
 *   st-15 → external_output_commitment（性格ではなく runtime context）
 */
export const PENDING_TIMING_KEYS = [
  // derived timing feature — 18スコアからの派生。18スコアへ追加しない
  'role_shift', 'delegation_need', 'income_volatility', 'address_change',
  // relationship context — 相手情報か関係状況がある場合のみ
  'life_stage_divergence', 'power_balance_change',
  // derived trait — 既存71スコアへマッピングできない。新規定義が必要
  'work_autonomy_need',        // wk-15。独立・起業方向まで含む
  'learning_by_explaining',    // st-03。教えることで定着する学習スタイル
  // runtime context — 性格ではなく外部条件
  'external_output_commitment', // st-15。発表日・提出相手・外部締切の有無
] as const
export type PendingTimingKey = typeof PENDING_TIMING_KEYS[number]

// ────────────────────────────────────────────────
// スコア条件
// ────────────────────────────────────────────────

export type ScoreOperator = 'gte' | 'lte' | 'between'

/**
 * 閾値。文書の low / medium / high / very_high を数値へ確定させる。
 * ★'low' は「0以上」ではなく上限条件。取り違えると条件が常に真になる。
 */
export const SCORE_BOUNDS = {
  low: { op: 'lte', value: 0.32 },
  medium: { op: 'between', min: 0.33, max: 0.65 },
  medium_or_high: { op: 'gte', value: 0.33 },
  high: { op: 'gte', value: 0.66 },
  very_high: { op: 'gte', value: 0.85 },
} as const
export type ScoreLevel = keyof typeof SCORE_BOUNDS

export interface ScoreGate {
  key: TimingScoreKey
  op: ScoreOperator
  value?: number
  min?: number
  max?: number
  /** 元の文書での表記。追跡用 */
  level: ScoreLevel
}

export interface TraitScoreGate {
  key: TraitGateKey
  op: ScoreOperator
  value?: number
  min?: number
  max?: number
  level: ScoreLevel
}

export interface TimingMatch {
  /** すべて満たす必要があるスコア条件 */
  allScores?: readonly ScoreGate[]
  /** いずれか1つを満たせばよいスコア条件 */
  anyScores?: readonly ScoreGate[]
  /** 性格スコアのゲート。すべて満たす */
  traitAll?: readonly TraitScoreGate[]
  /** 性格スコアのゲート。いずれか1つ */
  traitAny?: readonly TraitScoreGate[]
  relationshipStatus?: readonly RelationshipStatus[]
  workStatus?: readonly WorkStatus[]
  historyAll?: readonly HistoryKey[]
  historyAny?: readonly HistoryKey[]
  /** 同時に成立している必要があるイベント。すべて */
  coEventsAll?: readonly LifeEventKey[]
  /** 同時に成立している必要があるイベント。いずれか1つ */
  coEventsAny?: readonly LifeEventKey[]
  runtimeContext?: Readonly<Record<string, TimingRuntimeContextValue>>
  /** ★実装されるまで評価しない */
  pending?: readonly PendingTimingKey[]
}

/**
 * 文章の具体性。候補の順位付けに使う。
 * ★pending を無視した資産を score_specific として扱わないこと。
 */
/**
 * 資産が使用可能か。
 * ★pending 条件を持つ資産は resolver が実装されるまで disabled_until_resolved にする。
 *   「未実装だから無視する」は、条件を満たしたものとして扱うのと同じで危険。
 *   wk-17 は role_shift、st-15 は verbal_processing が必要だが、
 *   Phase 1b までは条件が評価されず、fallback として誰にでも出ていた。
 */
export type ClaimAvailability = 'enabled' | 'disabled_until_resolved'

export type ClaimSpecificity =
  /** スコア条件を持たない。誰にでも出せる */
  | 'fallback'
  /** 18スコアの条件を満たしたときだけ出せる */
  | 'score_specific'
  /** 複数イベントが同時に立ったときだけ出せる */
  | 'compound'

export type TimingShape =
  | 'event' | 'contrast' | 'condition' | 'sequence' | 'cost' | 'repair'

export type EventOccurrence = 'any' | 'first' | 'later'

export interface TimingClaimAsset {
  id: string
  /** 1件なら単一、2件以上なら複合（全イベントが立っているときだけ出す） */
  events: readonly LifeEventKey[]
  occurrence: EventOccurrence
  shape: TimingShape
  typeLabel: string
  proposition: string
  counterpart?: string
  condition?: string
  cost?: string
  behavior: string
  headline: boolean
  salienceBase: number
  specificity: ClaimSpecificity
  availability: ClaimAvailability
  /**
   * 同義文章のグループ。鑑定書内での再利用制御に使う。
   * ★Phase 2c で意味単位へ再分類した（event:shape → event:意味）。
   *   旧分類では meeting:event に「過去の相手との再会」「見た目の変化」
   *   「職場での出会い」など意味の異なる8件が同居しており、
   *   cooldown をかけると無関係な文章までブロックされていた。
   */
  semanticGroup: string
  match: TimingMatch
}
