// ─── localStorage fallback — utilisé quand la table Supabase n'existe pas ────
// Basculer sur Supabase quand supabase/schema.sql aura été exécuté.

const KEY = 'nhboost_tickets'

export type LocalTicket = {
  id:         string
  ref:        string
  subject:    string
  message:    string
  priority:   'low' | 'medium' | 'high'
  status:     'open' | 'in_progress' | 'resolved'
  created_at: string
}

function genRef(): string {
  const year = new Date().getFullYear()
  const existing = getAll()
  const next = String(existing.length + 1).padStart(4, '0')
  return `TKT-${year}-${next}`
}

export function getAll(): LocalTicket[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function insert(
  ticket: Omit<LocalTicket, 'id' | 'ref' | 'created_at'>
): LocalTicket {
  const now = new Date().toISOString()
  const newTicket: LocalTicket = {
    ...ticket,
    id:         crypto.randomUUID(),
    ref:        genRef(),
    created_at: now,
  }
  const all = getAll()
  all.unshift(newTicket)
  localStorage.setItem(KEY, JSON.stringify(all))
  return newTicket
}
