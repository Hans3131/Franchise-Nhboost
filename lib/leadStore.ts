// ============================================================
// leadStore — Supabase-first
// ============================================================

import { createClient } from '@/lib/supabase/client'
import { insert as insertClient } from '@/lib/clientStore'
import type { Lead, LeadStatus } from '@/types'

export async function getAll(): Promise<Lead[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && data) return data as Lead[]
    }
  } catch {}
  return []
}

export async function updateStatus(id: string, status: LeadStatus): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('leads').update({ status }).eq('id', id).eq('user_id', user.id)
    }
  } catch {}
}

export async function convertToClient(leadId: string): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Fetch lead
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', user.id)
      .single()
    if (!lead) return null

    // Create client in CRM
    const client = await insertClient({
      company_name: lead.company || lead.name,
      contact_name: lead.name,
      email: lead.email,
      phone: lead.phone,
      commercial_status: 'prospect',
      upsell_potential: 'medium',
      pipeline_stage: 'lead_received',
      deal_value: 0,
    })

    // Link lead to client + mark converted
    await supabase.from('leads').update({
      status: 'converted',
      client_id: client.id,
    }).eq('id', leadId)

    // Create notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'system',
      title: `Lead converti : ${lead.name}`,
      message: `${lead.name} a été ajouté à votre CRM.`,
      link: `/crm/${client.id}`,
    })

    return client.id
  } catch {
    return null
  }
}
