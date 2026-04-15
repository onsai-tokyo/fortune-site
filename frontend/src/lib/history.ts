import { supabase } from './supabase'

export interface AnalysisRecord {
  id: string
  user_id: string
  feature: string
  birth_date: string | null
  title: string | null
  content: unknown | null
  created_at: string
}

export async function saveAnalysis(
  userId: string,
  feature: string,
  birthDate: string,
  title: string,
  content?: unknown
): Promise<string | null> {
  const { data, error } = await supabase
    .from('analyses')
    .insert({ user_id: userId, feature, birth_date: birthDate, title, content })
    .select('id')
    .single()
  if (error) console.error('[saveAnalysis] error:', error)
  return data?.id ?? null
}

export async function getAnalysis(id: string): Promise<AnalysisRecord | null> {
  const { data } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .single()
  return data ?? null
}

export async function saveChatMessages(
  recordId: string,
  messages: { role: string; content: string }[]
) {
  const { data: record } = await supabase
    .from('analyses')
    .select('content')
    .eq('id', recordId)
    .single()
  const existing = record?.content as Record<string, unknown> | null
  const result = existing?.result ?? existing
  await supabase
    .from('analyses')
    .update({ content: { result, chat: messages } })
    .eq('id', recordId)
}

export async function getAnalyses(userId: string): Promise<AnalysisRecord[]> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) console.error('[getAnalyses] error:', error)
  return data ?? []
}
