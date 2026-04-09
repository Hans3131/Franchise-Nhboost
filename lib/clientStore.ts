// ============================================================
// clientStore — Supabase-first avec fallback localStorage
// ============================================================

import { createClient } from '@/lib/supabase/client'
import type { Client, ClientNote } from '@/types'

const KEY = 'nhboost_clients'
const NOTES_KEY = 'nhboost_client_notes'

// ─── localStorage helpers ────────────────────────────────────

function localGetAll(): Client[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function localSave(clients: Client[]) {
  localStorage.setItem(KEY, JSON.stringify(clients))
}

function localGetNotes(): ClientNote[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]') } catch { return [] }
}

function localSaveNotes(notes: ClientNote[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

// ─── API publique ────────────────────────────────────────────

export async function getAll(): Promise<Client[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      if (!error && data) return data as Client[]
    }
  } catch {}
  return localGetAll()
}

export async function getById(id: string): Promise<Client | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (!error && data) return data as Client
    }
  } catch {}
  return localGetAll().find(c => c.id === id) ?? null
}

export async function insert(
  client: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Client> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...client, user_id: user.id })
        .select()
        .single()
      if (!error && data) return data as Client
    }
  } catch {}
  // Fallback localStorage
  const now = new Date().toISOString()
  const newClient: Client = {
    ...client,
    id: crypto.randomUUID(),
    user_id: '',
    created_at: now,
    updated_at: now,
  }
  const all = localGetAll()
  all.unshift(newClient)
  localSave(all)
  return newClient
}

export async function update(
  id: string,
  patch: Partial<Omit<Client, 'id' | 'user_id' | 'created_at'>>
): Promise<void> {
  // localStorage
  const all = localGetAll().map(c =>
    c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c
  )
  localSave(all)
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('clients').update(patch).eq('id', id).eq('user_id', user.id)
    }
  } catch {}
}

export async function remove(id: string): Promise<void> {
  localSave(localGetAll().filter(c => c.id !== id))
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('clients').delete().eq('id', id).eq('user_id', user.id)
    }
  } catch {}
}

// ─── Notes ───────────────────────────────────────────────────

export async function getNotes(clientId: string): Promise<ClientNote[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (!error && data) return data as ClientNote[]
  } catch {}
  return localGetNotes().filter(n => n.client_id === clientId)
}

export async function addNote(
  clientId: string,
  note: Omit<ClientNote, 'id' | 'client_id' | 'user_id' | 'created_at'>
): Promise<ClientNote> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('client_notes')
        .insert({ ...note, client_id: clientId, user_id: user.id })
        .select()
        .single()
      if (!error && data) return data as ClientNote
    }
  } catch {}
  const newNote: ClientNote = {
    ...note,
    id: crypto.randomUUID(),
    client_id: clientId,
    user_id: '',
    created_at: new Date().toISOString(),
  }
  const notes = localGetNotes()
  notes.unshift(newNote)
  localSaveNotes(notes)
  return newNote
}

export async function updateNote(
  noteId: string,
  patch: Partial<Pick<ClientNote, 'content' | 'completed' | 'followup_date'>>
): Promise<void> {
  const notes = localGetNotes().map(n => n.id === noteId ? { ...n, ...patch } : n)
  localSaveNotes(notes)
  try {
    const supabase = createClient()
    await supabase.from('client_notes').update(patch).eq('id', noteId)
  } catch {}
}

// ─── Client orders ───────────────────────────────────────────

export async function getClientOrders(clientId: string): Promise<Record<string, unknown>[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && data) return data
    }
  } catch {}
  return []
}
