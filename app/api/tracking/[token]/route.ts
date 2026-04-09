import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetAt) { rateLimitStore.set(key, { count: 1, resetAt: now + 60000 }); return true }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || !checkRateLimit(token)) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 429 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Config manquante' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: order, error } = await supabase
    .from('orders')
    .select('ref, service, status, service_type, internal_progress_status, deliverables_url, created_at, updated_at, user_id')
    .eq('public_token', token)
    .eq('public_tracking_enabled', true)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 })
  }

  // Get franchise name
  let franchiseName = 'NHBoost'
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name')
    .eq('id', order.user_id)
    .single()
  if (profile?.company_name) franchiseName = profile.company_name

  return NextResponse.json({
    ref: order.ref,
    service: order.service,
    status: order.status,
    serviceType: order.service_type,
    progress: order.internal_progress_status,
    deliverablesUrl: order.deliverables_url,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    franchiseName,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
