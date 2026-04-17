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
    // Vérifie que les env vars sont là (cas Vercel pas redeploy)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[create-franchisee] Supabase env vars missing')
      return NextResponse.json(
        { error: 'Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY). Contactez l\'administrateur système.' },
        { status: 500 },
      )
    }

    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const { data: newUser, error: authError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !newUser?.user) {
      const rawMsg = authError?.message ?? 'Utilisateur non créé'
      console.error('[create-franchisee] auth error:', rawMsg, 'code:', authError?.code, 'status:', authError?.status)

      // Map les erreurs Supabase aux messages FR clairs
      let userMsg = 'Erreur création du compte'
      const lowerMsg = rawMsg.toLowerCase()

      if (lowerMsg.includes('already') && (lowerMsg.includes('registered') || lowerMsg.includes('exists'))) {
        userMsg = 'Cet email est déjà utilisé par un autre franchisé ou admin.'
      } else if (lowerMsg.includes('email') && lowerMsg.includes('invalid')) {
        userMsg = 'Email invalide. Vérifiez le format.'
      } else if (lowerMsg.includes('password') && (lowerMsg.includes('short') || lowerMsg.includes('weak') || lowerMsg.includes('6 char'))) {
        userMsg = 'Mot de passe trop court (min. 6 caractères Supabase).'
      } else if (lowerMsg.includes('rate limit')) {
        userMsg = 'Trop de créations récentes. Attendez quelques minutes.'
      } else if (lowerMsg.includes('signups') && lowerMsg.includes('disabled')) {
        userMsg = 'Les inscriptions sont désactivées dans Supabase. Active-les dans Auth → Providers.'
      } else {
        // Détail pour faciliter le debug admin
        userMsg = `Erreur création du compte : ${rawMsg}`
      }

      return NextResponse.json({ error: userMsg }, { status: 500 })
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
      // Rollback : on supprime l'utilisateur auth créé juste avant
      await svc.auth.admin.deleteUser(userId)
      console.error('[create-franchisee] profile error:', profileError.message, 'code:', profileError.code)

      let userMsg = 'Erreur création du profil'
      const lowerMsg = profileError.message.toLowerCase()

      if (profileError.code === '23505' || lowerMsg.includes('duplicate')) {
        if (lowerMsg.includes('franchise_code')) {
          userMsg = 'Ce code franchise est déjà utilisé. Choisissez-en un autre.'
        } else if (lowerMsg.includes('franchise_key')) {
          userMsg = 'Conflit de clé franchise (réessayez).'
        } else {
          userMsg = 'Un profil avec ces données existe déjà.'
        }
      } else if (profileError.code === '42703' || lowerMsg.includes('column') && lowerMsg.includes('does not exist')) {
        userMsg = 'Une colonne manque dans la table profiles (role, account_status, first_name, last_name). Exécute la migration clients_pipeline_fields.sql.'
      } else {
        userMsg = `Erreur création du profil : ${profileError.message}`
      }

      return NextResponse.json({ error: userMsg }, { status: 500 })
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

        // URL du portail (pour le CTA "Se connecter")
        const appUrl = (
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        ).replace(/\/$/, '')
        const loginUrl = `${appUrl}/login`
        const supportEmail = process.env.SUPPORT_EMAIL || 'support@nhboost.com'

        await transporter.sendMail({
          from: `"NHBoost" <${gmailUser}>`,
          to: email,
          subject: '🎉 Bienvenue chez NHBoost — Votre espace franchisé est prêt',
          // Version texte pour les clients mail qui ne lisent pas le HTML
          text: [
            `Bonjour ${first_name},`,
            '',
            'Félicitations — vous venez d\'être ajouté en tant que franchisé chez NHBoost.',
            'Votre espace personnel vous attend : commandes, CRM clients, leads, budget pub,',
            'analytics et bien plus. Tout est déjà configuré.',
            '',
            'Voici vos identifiants :',
            `  • Email       : ${email}`,
            `  • Mot de passe : ${password}`,
            `  • Code franchise : ${code}`,
            '',
            `Se connecter : ${loginUrl}`,
            '',
            'Pensez à changer votre mot de passe dès votre première connexion,',
            'depuis Paramètres > Sécurité.',
            '',
            `Besoin d'aide ? ${supportEmail}`,
            '',
            '— L\'équipe NHBoost',
          ].join('\n'),
          html: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#F5F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F7FA;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(45,45,96,0.08);">

            <!-- Header gradient -->
            <tr>
              <td style="background:linear-gradient(135deg,#2d2d60 0%,#4A7DC4 60%,#6AAEE5 100%);padding:40px 40px 32px;text-align:center;">
                <div style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#FFFFFF;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:20px;margin-bottom:20px;">
                  NHBoost · Portail franchisé
                </div>
                <h1 style="margin:0;color:#FFFFFF;font-size:28px;font-weight:700;line-height:1.2;">
                  🎉 Bienvenue ${escapeHtml(first_name)} !
                </h1>
                <p style="margin:12px 0 0;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.5;">
                  Vous venez d'être ajouté en tant que franchisé chez NHBoost
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 40px 12px;">
                <p style="margin:0 0 16px;color:#2d2d60;font-size:15px;line-height:1.6;">
                  Bonjour <strong>${escapeHtml(first_name)} ${escapeHtml(last_name)}</strong>,
                </p>
                <p style="margin:0 0 16px;color:#4A5180;font-size:14px;line-height:1.7;">
                  Nous sommes ravis de vous compter parmi les franchisés NHBoost. Votre espace
                  personnel est désormais actif et vous permet de gérer :
                </p>
                <ul style="margin:0 0 24px;padding:0 0 0 20px;color:#4A5180;font-size:14px;line-height:1.9;">
                  <li>Vos commandes de services avec paiement sécurisé</li>
                  <li>Votre CRM clients et votre pipeline commercial</li>
                  <li>Les leads entrants automatiquement assignés</li>
                  <li>Votre budget publicitaire et vos campagnes</li>
                  <li>Les formations de l'académie NHBoost</li>
                </ul>
              </td>
            </tr>

            <!-- Credentials card -->
            <tr>
              <td style="padding:0 40px;">
                <div style="background:linear-gradient(135deg,rgba(106,174,229,0.08) 0%,rgba(43,53,128,0.05) 100%);border:1px solid rgba(106,174,229,0.25);border-radius:12px;padding:24px;">
                  <p style="margin:0 0 14px;color:#2d2d60;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                    🔑 Vos identifiants
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'SF Mono',Menlo,Consolas,monospace;">
                    <tr>
                      <td style="padding:8px 0;color:#8B95C4;font-size:12px;width:140px;">Email</td>
                      <td style="padding:8px 0;color:#2d2d60;font-size:14px;font-weight:600;word-break:break-all;">${escapeHtml(email)}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#8B95C4;font-size:12px;border-top:1px dashed rgba(106,174,229,0.2);">Mot de passe</td>
                      <td style="padding:8px 0;color:#2d2d60;font-size:14px;font-weight:600;border-top:1px dashed rgba(106,174,229,0.2);word-break:break-all;">${escapeHtml(password)}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#8B95C4;font-size:12px;border-top:1px dashed rgba(106,174,229,0.2);">Code franchise</td>
                      <td style="padding:8px 0;color:#2d2d60;font-size:14px;font-weight:600;border-top:1px dashed rgba(106,174,229,0.2);">${escapeHtml(code)}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>

            <!-- CTA button -->
            <tr>
              <td style="padding:28px 40px;text-align:center;">
                <a href="${loginUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#2d2d60 0%,#4A7DC4 100%);color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;box-shadow:0 4px 12px rgba(45,45,96,0.25);">
                  Accéder à mon espace →
                </a>
                <p style="margin:14px 0 0;color:#8B95C4;font-size:11px;">
                  ou copiez ce lien : <a href="${loginUrl}" style="color:#6AAEE5;text-decoration:none;">${loginUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Security tip -->
            <tr>
              <td style="padding:0 40px 12px;">
                <div style="background:#FEF3C7;border-left:3px solid #F59E0B;padding:14px 16px;border-radius:6px;">
                  <p style="margin:0;color:#92400E;font-size:13px;line-height:1.5;">
                    <strong>⚠ Sécurité :</strong> par précaution, nous vous invitons à modifier votre
                    mot de passe dès votre première connexion, depuis <em>Paramètres → Sécurité</em>.
                  </p>
                </div>
              </td>
            </tr>

            <!-- Support -->
            <tr>
              <td style="padding:24px 40px 36px;border-top:1px solid #E2E8F2;">
                <p style="margin:0 0 8px;color:#4A5180;font-size:13px;line-height:1.6;">
                  Une question, un souci ? L'équipe NHBoost est à votre disposition.
                </p>
                <p style="margin:0;color:#8B95C4;font-size:12px;">
                  📧 <a href="mailto:${supportEmail}" style="color:#6AAEE5;text-decoration:none;">${escapeHtml(supportEmail)}</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 40px;background:#F8FAFC;text-align:center;">
                <p style="margin:0;color:#8B95C4;font-size:11px;line-height:1.5;">
                  © ${new Date().getFullYear()} NHBoost · Réseau de franchisés<br>
                  Cet email a été envoyé automatiquement à ${escapeHtml(email)}<br>
                  suite à la création de votre compte franchisé.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
        })
      }
    } catch (e) {
      console.error('[create-franchisee] email send failed (best-effort):', e)
      /* email best-effort — on ne bloque pas la création */
    }

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
