// ============================================================
// messageStore — Messages par commande (Supabase-first)
// ============================================================

import { createClient } from '@/lib/supabase/client'

export interface OrderMessage {
  id: string
  order_id: string
  user_id: string
  sender_role: 'franchisee' | 'admin'
  content: string
  read: boolean
  created_at: string
}

export async function getMessages(orderId: string): Promise<OrderMessage[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('order_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
    if (!error && data) return data as OrderMessage[]
  } catch {}
  return []
}

export async function sendMessage(orderId: string, content: string): Promise<OrderMessage | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('order_messages')
      .insert({
        order_id: orderId,
        user_id: user.id,
        sender_role: 'franchisee',
        content,
      })
      .select()
      .single()
    if (!error && data) return data as OrderMessage
  } catch {}
  return null
}

export async function markRead(orderId: string): Promise<void> {
  try {
    const supabase = createClient()
    await supabase
      .from('order_messages')
      .update({ read: true })
      .eq('order_id', orderId)
      .eq('read', false)
  } catch {}
}

export async function getUnreadCount(orderId: string): Promise<number> {
  try {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('order_messages')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .eq('read', false)
      .eq('sender_role', 'admin')
    if (!error && count !== null) return count
  } catch {}
  return 0
}
