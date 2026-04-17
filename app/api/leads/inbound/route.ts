// ============================================================
// POST /api/leads/inbound
// Endpoint PUBLIC pour recevoir les leads depuis formulaires
// externes (landing pages, intégrations, etc.)
// ============================================================
// ⚠ Endpoint sans authentification — protection par :
//   1. Rate limit par IP (anti-énumération + anti-spam)
//   2. Rate limit par franchise_key (anti-abus d'une clé valide)
//   3. Validation de la franchise_key → profil Supabase
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Config rate limits ─────────────────────────────────────
// IP : 20 requêtes / minute (bloque l'énumération massive)
// Un attaquant avec 1 IP ne peut pas tenter 4Md de franchise_keys
const IP_RATE_LIMIT = 20
const IP_RATE_WINDOW_MS = 60 * 1_000 // 1 minute

// franchise_key valide : 60 / heure (anti-spam d'un key connu)
const KEY_RATE_LIMIT = 60
const KEY_RATE_WINDOW_MS = 60 * 60 * 1_000 // 1 heure

// ─── Helpers ────────────────────────────────────────────────
/**
 * Extrait l'IP client depuis les headers (Vercel, Cloudflare, nginx).
 * Retourne 'unknown' si aucun header fiable n'est présent.
 */
function getClientIp(req: NextRequest): string {
  // Vercel + proxies standard
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    // Format "client, proxy1, proxy2" — la première IP est le client
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  // Cloudflare
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  // Nginx / autres reverse proxies
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  // Aucun header → on traite comme suspicieux avec une clé fixe
  // (tous les requêtes "unknown" partagent le même compteur → vite bloqué)
  return 'unknown'
}

/** Construit une réponse 429 avec headers Retry-After et CORS */
function tooManyRequests(resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'Trop de requêtes. Réessayez plus tard.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': '0',
        'Access-Control-Allow-Origin': '*',
      },
    },
  )
}

// ─── POST handler (public, no auth) ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    // ─── 1. Rate limit par IP (PREMIER, avant tout) ──────
    // Bloque l'énumération : un attaquant avec 1 IP ne peut pas
    // tester des milliers de franchise_keys pour en trouver une
    // valide. Doit être fait AVANT toute lecture DB.
    const clientIp = getClientIp(req)
    const ipCheck = rateLimit(
      `leads-inbound:ip:${clientIp}`,
      IP_RATE_LIMIT,
      IP_RATE_WINDOW_MS,
    )
    if (!ipCheck.allowed) {
      console.warn(`[leads/inbound] IP rate limit hit: ${clientIp}`)
      return tooManyRequests(ipCheck.resetAt)
    }

    // ─── 2. Parse + validation body ──────────────────────
    let body: {
      franchise_key?: string
      name?: string
      email?: string
      phone?: string
      company?: string
      message?: string
      source?: string
      source_detail?: string
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }

    const {
      franchise_key,
      name,
      email,
      phone,
      company,
      message,
      source,
      source_detail,
    } = body

    if (!franchise_key || !name) {
      return NextResponse.json(
        { error: 'franchise_key et name sont requis' },
        { status: 400 },
      )
    }

    // ─── 3. Rate limit par franchise_key ─────────────────
    const keyCheck = rateLimit(
      `leads-inbound:key:${franchise_key}`,
      KEY_RATE_LIMIT,
      KEY_RATE_WINDOW_MS,
    )
    if (!keyCheck.allowed) {
      console.warn(`[leads/inbound] Key rate limit hit: ${franchise_key}`)
      return tooManyRequests(keyCheck.resetAt)
    }

    // ─── 4. Service role client (bypass RLS) ─────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[leads/inbound] Supabase env vars missing')
      return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // ─── 5. Résoudre franchise_key → user_id ─────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('franchise_key', franchise_key)
      .single()

    if (profileError || !profile) {
      // Ne pas révéler si la clé existe ou non (anti-oracle)
      // Mais on logue côté serveur pour détecter les enumerations
      console.warn(
        `[leads/inbound] Invalid franchise_key from IP ${clientIp}: ${String(franchise_key).slice(0, 20)}`,
      )
      return NextResponse.json({ error: 'Franchise key invalide' }, { status: 404 })
    }

    const userId = profile.id

    // ─── 6. Insert lead ──────────────────────────────────
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
      console.error('[leads/inbound] insert error:', leadError.message)
      return NextResponse.json({ error: 'Erreur insertion lead' }, { status: 500 })
    }

    // ─── 7. Notification franchisé ───────────────────────
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'system',
      title: `Nouveau lead : ${name}`,
      message: `${company || name}${email ? ' — ' + email : ''}${phone ? ' — ' + phone : ''}`,
      link: '/mes-leads',
    })

    return NextResponse.json(
      { ok: true, lead_id: lead?.id },
      {
        headers: {
          'X-RateLimit-IP-Remaining': String(ipCheck.remaining),
          'X-RateLimit-Key-Remaining': String(keyCheck.remaining),
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  } catch (e) {
    console.error('[leads/inbound] unexpected error:', e)
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
      'Access-Control-Max-Age': '86400',
    },
  })
}
