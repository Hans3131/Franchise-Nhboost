// ============================================================
// chatStore — Supabase-first avec fallback localStorage
// ============================================================

import { createClient } from '@/lib/supabase/client'

export interface ChatMsg {
  role:      'user' | 'assistant'
  content:   string
  timestamp: string
}

export interface LocalChatSession {
  id:          string
  title:       string
  devis_id?:   string
  facture_id?: string
  messages:    ChatMsg[]
  created_at:  string
  updated_at:  string
}

const KEY = 'nhboost_chat_sessions'

// ─── localStorage helpers ────────────────────────────────────

function localGetAll(): LocalChatSession[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function localSave(sessions: LocalChatSession[]) {
  localStorage.setItem(KEY, JSON.stringify(sessions))
}

// ─── Supabase row → LocalChatSession ─────────────────────────

function mapRow(r: Record<string, unknown>): LocalChatSession {
  return {
    id:         String(r.id),
    title:      String(r.title ?? 'Nouvelle conversation'),
    devis_id:   r.devis_id ? String(r.devis_id) : undefined,
    facture_id: r.facture_id ? String(r.facture_id) : undefined,
    messages:   (r.messages as ChatMsg[]) ?? [],
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: String(r.updated_at ?? r.created_at ?? new Date().toISOString()),
  }
}

// ─── API publique ────────────────────────────────────────────

export async function getSessions(): Promise<LocalChatSession[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      if (!error && data) return data.map(r => mapRow(r as Record<string, unknown>))
    }
  } catch {}
  return localGetAll()
}

export async function getSession(id: string): Promise<LocalChatSession | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (!error && data) return mapRow(data as Record<string, unknown>)
    }
  } catch {}
  return localGetAll().find(s => s.id === id) ?? null
}

export async function createSession(): Promise<LocalChatSession> {
  const now = new Date().toISOString()
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, title: 'Nouvelle conversation', messages: [] })
        .select()
        .single()
      if (!error && data) return mapRow(data as Record<string, unknown>)
    }
  } catch {}
  const session: LocalChatSession = {
    id:         crypto.randomUUID(),
    title:      'Nouvelle conversation',
    messages:   [],
    created_at: now,
    updated_at: now,
  }
  const all = localGetAll()
  all.unshift(session)
  localSave(all)
  return session
}

export async function saveMessages(id: string, messages: ChatMsg[]): Promise<void> {
  // localStorage
  const all = localGetAll().map(s =>
    s.id === id ? { ...s, messages, updated_at: new Date().toISOString() } : s
  )
  localSave(all)
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('chat_sessions')
        .update({ messages, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
    }
  } catch {}
}

export async function deleteSession(id: string): Promise<void> {
  const all = localGetAll().filter(s => s.id !== id)
  localSave(all)
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('chat_sessions').delete().eq('id', id).eq('user_id', user.id)
    }
  } catch {}
}
