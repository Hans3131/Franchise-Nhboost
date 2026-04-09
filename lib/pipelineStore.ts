// ============================================================
// pipelineStore — Pipeline commercial
// ============================================================

import { createClient } from '@/lib/supabase/client'
import type { PipelineStage, PipelineHistoryEntry } from '@/types'

export async function moveStage(
  clientId: string,
  fromStage: PipelineStage | null,
  toStage: PipelineStage,
  note?: string
): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Update client stage
    const updateData: Record<string, unknown> = { pipeline_stage: toStage }
    // Sync commercial_status
    if (toStage === 'won') updateData.commercial_status = 'active'
    else if (toStage === 'lost') updateData.commercial_status = 'lost'
    else if (toStage === 'lead_received') updateData.commercial_status = 'prospect'
    else if (toStage === 'contacted' || toStage === 'quote_sent' || toStage === 'negotiation') updateData.commercial_status = 'qualified'

    await supabase.from('clients').update(updateData).eq('id', clientId).eq('user_id', user.id)

    // Insert history
    await supabase.from('pipeline_history').insert({
      client_id: clientId,
      user_id: user.id,
      from_stage: fromStage,
      to_stage: toStage,
      note: note ?? null,
    })
  } catch {}
}

export async function getHistory(clientId: string): Promise<PipelineHistoryEntry[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('pipeline_history')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (!error && data) return data as PipelineHistoryEntry[]
  } catch {}
  return []
}
