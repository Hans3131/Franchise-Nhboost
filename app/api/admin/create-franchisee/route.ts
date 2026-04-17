import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// ─── Helpers sécurité ────────────────────────────────────────
function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Validation stricte
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_NAME = 100
const MAX_FIELD = 200

function sanitize(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return ''
  return val.trim().slice(0, maxLen)
}

export async function POST(req: NextRequest) {
  try {
    // ─── 1. Auth + role check ─────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // ─── 2. Input validation ──────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }

    const email = sanitize(body.email, 254).toLowerCase()
    const first_name = sanitize(body.first_name, MAX_NAME)
    const last_name = sanitize(body.last_name, MAX_NAME)
    const phone = sanitize(body.phone, 30) || null
    const address = sanitize(body.address, MAX_FIELD) || null
    const sector = sanitize(body.sector, MAX_FIELD) || null
    const franchise_code = sanitize(body.franchise_code, 20) || null
    const account_status = sanitize(body.account_status, 20) || 'active'
    // Si admin a fourni un password → l'utiliser. Sinon → générer et l'envoyer
    // UNE FOIS dans la réponse pour que l'admin puisse le communiquer.
    const providedPassword = sanitize(body.password, 128)
    const passwordWasGenerated = !providedPassword
    const password = providedPassword || generatePassword()

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (!first_name || first_name.length < 1) {
      return NextResponse.json({ error: 'Prénom requis' }, { status: 400 })
    }
    if (!last_name || last_name.length < 1) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe min. 8 caractères' }, { status: 400 })
    }
    if (!['active', 'pending', 'suspended'].includes(account_status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    // ─── 3. Create auth user ──────────────────────────────
    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: newUser, error: authError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !newUser?.user) {
      console.error('[create-franchisee] auth error:', authError?.message)
      return NextResponse.json({ error: 'Erreur création du compte' }, { status: 500 })
    }

    const userId = newUser.user.id
    const code = franchise_code || `FRA-${userId.slice(0, 6).toUpperCase()}`

    // ─── 4. Create profile ────────────────────────────────
    const { error: profileError } = await svc.from('profiles').insert({
      id: userId,
      company_name: `${first_name} ${last_name}`,
      first_name,
      last_name,
      phone,
      address,
      sector,
      franchise_code: code,
      franchise_key: `FK-${userId.slice(0, 8).toUpperCase()}`,
      role: 'franchisee',
      account_status,
    })

    if (profileError) {
      await svc.auth.admin.deleteUser(userId)
      console.error('[create-franchisee] profile error:', profileError.message)
      return NextResponse.json({ error: 'Erreur création du profil' }, { status: 500 })
    }

    // ─── 5. Send welcome email (XSS-safe) ─────────────────
    try {
      const gmailUser = process.env.GMAIL_USER
      const gmailPass = process.env.GMAIL_APP_PASSWORD
      if (gmailUser && gmailPass) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
        })

        await transporter.sendMail({
          from: `"NHBoost" <${gmailUser}>`,
          to: email,
          subject: 'Bienvenue sur NHBoost — Vos accès franchisé',
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
              <h2 style="color:#2d2d60">Bienvenue chez NHBoost !</h2>
              <p>Bonjour <strong>${escapeHtml(first_name)}</strong>,</p>
              <p>Votre compte franchisé a été créé. Voici vos identifiants :</p>
              <div style="background:#F5F7FA;border:1px solid #E2E8F2;border-radius:12px;padding:16px;margin:16px 0">
                <p style="margin:4px 0"><strong>Email :</strong> ${escapeHtml(email)}</p>
                <p style="margin:4px 0"><strong>Mot de passe :</strong> ${escapeHtml(password)}</p>
                <p style="margin:4px 0"><strong>Code franchise :</strong> ${escapeHtml(code)}</p>
              </div>
              <p>Connectez-vous sur votre portail et changez votre mot de passe dans les paramètres.</p>
              <p style="color:#6B7280;font-size:12px;margin-top:20px">— L'équipe NHBoost</p>
            </div>
          `,
        })
      }
    } catch { /* email best-effort */ }

    // ─── 6. Réponse (SANS mot de passe) ───────────────────
    return NextResponse.json({
      ok: true,
      franchisee: {
        id: userId,
        email,
        first_name,
        last_name,
        franchise_code: code,
        // Renvoyé UNIQUEMENT si auto-généré (route admin HTTPS, context admin authentifié)
        ...(passwordWasGenerated ? { generated_password: password } : {}),
      },
    })
  } catch (e) {
    console.error('[create-franchisee] unexpected error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
