import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { email, first_name, last_name, phone, address, sector, franchise_code, account_status } = body
    const password = body.password || generatePassword()

    if (!email || !first_name || !last_name) {
      return NextResponse.json({ error: 'Email, prénom et nom requis' }, { status: 400 })
    }

    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Create auth user
    const { data: newUser, error: authError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !newUser?.user) {
      return NextResponse.json({ error: authError?.message ?? 'Erreur création' }, { status: 500 })
    }

    const userId = newUser.user.id
    const code = franchise_code || `FRA-${userId.slice(0, 6).toUpperCase()}`

    // Create profile
    const { error: profileError } = await svc.from('profiles').insert({
      id: userId,
      company_name: `${first_name} ${last_name}`,
      first_name,
      last_name,
      phone: phone ?? null,
      address: address ?? null,
      sector: sector ?? null,
      franchise_code: code,
      franchise_key: `FK-${userId.slice(0, 8).toUpperCase()}`,
      role: 'franchisee',
      account_status: account_status ?? 'active',
    })

    if (profileError) {
      await svc.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: `Erreur profil: ${profileError.message}` }, { status: 500 })
    }

    // Send welcome email
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
              <p>Bonjour <strong>${first_name}</strong>,</p>
              <p>Votre compte franchisé a été créé. Voici vos identifiants :</p>
              <div style="background:#F5F7FA;border:1px solid #E2E8F2;border-radius:12px;padding:16px;margin:16px 0">
                <p style="margin:4px 0"><strong>Email :</strong> ${email}</p>
                <p style="margin:4px 0"><strong>Mot de passe :</strong> ${password}</p>
                <p style="margin:4px 0"><strong>Code franchise :</strong> ${code}</p>
              </div>
              <p>Connectez-vous sur votre portail et changez votre mot de passe dans les paramètres.</p>
              <p style="color:#6B7280;font-size:12px;margin-top:20px">— L'équipe NHBoost</p>
            </div>
          `,
        })
      }
    } catch { /* email best-effort */ }

    return NextResponse.json({
      ok: true,
      franchisee: { id: userId, email, first_name, last_name, franchise_code: code, password },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
