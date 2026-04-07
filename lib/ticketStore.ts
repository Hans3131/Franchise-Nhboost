// ============================================================
// ticketStore — Supabase-first avec fallback localStorage
// ============================================================

import { createClient } from '@/lib/supabase/client'

export type LocalTicket = {
  id:         string
  ref:        string
  subject:    string
  message:    string
  priority:   'low' | 'medium' | 'high'
  status:     'open' | 'in_progress' | 'resolved'
  order_id?:  string | null
  created_at: string
}

const KEY = 'nhboost_tickets'

// ─── localStorage helpers (privés) ───────────────────────────

function localGenRef(): string {
  const year = new Date().getFullYear()
  const existing = localGetAll()
  const next = String(existing.length + 1).padStart(4, '0')
  return `TKT-${year}-${next}`
}

function localGetAll(): LocalTicket[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function localInsert(
  ticket: Omit<LocalTicket, 'id' | 'ref' | 'created_at'>
): LocalTicket {
  const now = new Date().toISOString()
  const newTicket: LocalTicket = {
    ...ticket,
    id:         crypto.randomUUID(),
    ref:        localGenRef(),
    created_at: now,
  }
  const all = localGetAll()
  all.unshift(newTicket)
  localStorage.setItem(KEY, JSON.stringify(all))
  return newTicket
}

// ─── Supabase row → LocalTicket ──────────────────────────────

function mapRow(r: Record<string, unknown>): LocalTicket {
  return {
    id:         String(r.id),
    ref:        String(r.ref ?? ''),
    subject:    String(r.subject ?? ''),
    message:    String(r.message ?? ''),
    priority:   (r.priority as LocalTicket['priority']) ?? 'medium',
    status:     (r.status as LocalTicket['status'])     ?? 'open',
    order_id:   r.order_id ? String(r.order_id) : null,
    created_at: String(r.created_at ?? new Date().toISOString()),
  }
}

// ─── API publique (async, Supabase-first) ────────────────────

export async function getAll(): Promise<LocalTicket[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && data) return data.map(r => mapRow(r as Record<string, unknown>))
    }
  } catch {}
  return localGetAll()
}

export async function insert(
  ticket: Omit<LocalTicket, 'id' | 'ref' | 'created_at'>
): Promise<LocalTicket> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id:  user.id,
          subject:  ticket.subject,
          message:  ticket.message,
          priority: ticket.priority,
          status:   ticket.status ?? 'open',
          order_id: ticket.order_id ?? null,
        })
        .select()
        .single()
      if (!error && data) return mapRow(data as Record<string, unknown>)
    }
  } catch {}
  return localInsert(ticket)
}
