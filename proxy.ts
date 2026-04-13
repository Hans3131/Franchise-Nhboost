import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Routes protégées — nécessitent une authentification ──────
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/commander',
  '/commandes',
  '/support',
  '/projets',
  '/ressources',
  '/parametres',
  '/budget-ads',
  '/paiement',
  '/crm',
  '/pipeline',
  '/mes-leads',
  '/analytics',
  '/academie',
  '/secretaire',
  '/catalogue',
  // API admin protégée au niveau proxy (defense-in-depth)
  '/api/admin',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── V-01 FIX : Bloquer les routes protégées si Supabase non configuré ──
  // Avant : on laissait passer → bypass total de l'auth
  // Après : on renvoie 503 sur les routes protégées
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
    const isAdmin = pathname.startsWith('/admin')
    if (isProtected || isAdmin) {
      return new NextResponse('Service unavailable — authentication not configured', { status: 503 })
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // !! Utiliser getUser() et non getSession() — getSession() est vulnérable côté serveur !!
  const { data: { user } } = await supabase.auth.getUser()

  // ─── Routes protégées (franchisé) ───────────────────────
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  const isAdmin = pathname.startsWith('/admin')

  if (!user && isProtected) {
    // API routes → 401 JSON au lieu de redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ─── Routes admin ──────────────────────────────────────
  if (isAdmin && pathname !== '/admin/login') {
    if (!user) {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    // Vérifie le rôle admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role ?? 'franchisee'
    if (role !== 'admin' && role !== 'super_admin') {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
      const url = new URL('/admin/login', request.url)
      url.searchParams.set('denied', '1')
      return NextResponse.redirect(url)
    }
  }

  // Redirige vers /dashboard si déjà connecté et accès à /login
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // ─── V-03 FIX : Protection CSRF sur les mutations ──────
  // Vérifie que l'Origin correspond au domaine de l'app pour POST/PUT/PATCH/DELETE
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin')
    // Les webhooks Stripe n'ont pas d'origin → on les laisse passer
    // (la vérification signature se fait dans le handler)
    const isWebhook = pathname.startsWith('/api/webhooks/')
    const isLeadsInbound = pathname === '/api/leads/inbound'
    if (origin && !isWebhook && !isLeadsInbound) {
      const ownOrigin = request.nextUrl.origin
      if (origin !== ownOrigin) {
        return NextResponse.json(
          { error: 'Requête cross-origin rejetée' },
          { status: 403 },
        )
      }
    }
  }

  // ─── Headers de sécurité ────────────────────────────────
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // V-18 FIX : HSTS
  supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  // V-13 FIX : CSP basique (autorise Stripe, Supabase, inline styles pour Tailwind)
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.stripe.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com",
      "frame-src https://js.stripe.com https://checkout.stripe.com",
      "font-src 'self' data:",
    ].join('; '),
  )

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
