import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Rate limiting ───────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60
const RATE_WINDOW = 60 * 60 * 1000

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ─── POST handler (public, no auth) ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { franchise_key, name, email, phone, company, message, source, source_detail } = body

    if (!franchise_key || !name) {
      return NextResponse.json({ error: 'franchise_key et name sont requis' }, { status: 400 })
    }

    // Rate limit
    if (!checkRateLimit(franchise_key)) {
      return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
    }

    // Service role client (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Resolve franchise_key → user_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('franchise_key', franchise_key)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Franchise key invalide' }, { status: 404 })
    }

    const userId = profile.id

    // Insert lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        user_id: userId,
        name: String(name).slice(0, 200),
        email: email ? String(email).slice(0, 200) : null,
        phone: phone ? String(phone).slice(0, 50) : null,
        company: company ? String(company).slice(0, 200) : null,
        message: message ? String(message).slice(0, 2000) : null,
        source: source ? String(source).slice(0, 50) : 'form',
        source_detail: source_detail ? String(source_detail).slice(0, 200) : null,
        status: 'new',
      })
      .select('id')
      .single()

    if (leadError) {
      return NextResponse.json({ error: 'Erreur insertion lead' }, { status: 500 })
    }

    // Create notification for the franchisee
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'system',
      title: `Nouveau lead : ${name}`,
      message: `${company || name}${email ? ' — ' + email : ''}${phone ? ' — ' + phone : ''}`,
      link: '/mes-leads',
    })

    return NextResponse.json({ ok: true, lead_id: lead?.id })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ─── CORS preflight ──────────────────────────────────────────
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
