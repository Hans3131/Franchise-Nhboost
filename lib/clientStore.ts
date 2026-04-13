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
  // Nettoyage : enlève les champs qui ne sont pas dans la table clients
  // (sécurité : si une colonne n'existe pas encore en DB, l'insert échouera sinon)
  const payload: Record<string, unknown> = { ...client }
  // Convertit les strings vides en null pour les colonnes optionnelles
  for (const key of Object.keys(payload)) {
    if (payload[key] === '') payload[key] = null
  }

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single()
      if (error) {
        console.error('[clientStore.insert] Supabase error:', error.message, error.details, error.hint)
        // Si c'est une colonne manquante, on le signale clairement
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.warn('[clientStore.insert] Migration manquante — exécute supabase/migrations/clients_pipeline_fields.sql')
        }
      } else if (data) {
        return data as Client
      }
    }
  } catch (e) {
    console.error('[clientStore.insert] exception:', e)
  }

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
      const { error } = await supabase.from('clients').update(patch).eq('id', id).eq('user_id', user.id)
      if (error) console.error('[clientStore.update] error:', error.message)
    }
  } catch (e) {
    console.error('[clientStore.update] exception:', e)
  }
}

export async function remove(id: string): Promise<void> {
  localSave(localGetAll().filter(c => c.id !== id))
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from('clients').delete().eq('id', id).eq('user_id', user.id)
      if (error) console.error('[clientStore.remove] error:', error.message)
    }
  } catch (e) {
    console.error('[clientStore.remove] exception:', e)
  }
}

// ─── Notes ───────────────────────────────────────────────────

export async function getNotes(clientId: string): Promise<ClientNote[]> {
  try {
    const supabase = createClient()
    // RLS protège déjà, mais on passe par le client (user_id) pour defense-in-depth
    const { data, error } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (error) console.error('[clientStore.getNotes] error:', error.message)
    if (!error && data) return data as ClientNote[]
  } catch (e) {
    console.error('[clientStore.getNotes] exception:', e)
  }
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
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // RLS protège via le join client_notes → clients → user_id
      // On logue les erreurs au lieu de les avaler
      const { error } = await supabase.from('client_notes').update(patch).eq('id', noteId)
      if (error) console.error('[clientStore.updateNote] error:', error.message)
    }
  } catch (e) {
    console.error('[clientStore.updateNote] exception:', e)
  }
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
