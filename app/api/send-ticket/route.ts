import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/lib/supabase/server'

const RECIPIENTS = ['nhboostpro@gmail.com', 'hansyapo0@gmail.com']

const PRIORITY_LABELS: Record<string, string> = {
  low:    '🟢 Faible',
  medium: '🟡 Moyen',
  high:   '🔴 Urgent',
}

// ─── Validation / sanitisation ───────────────────────────────
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

function sanitizeText(str: unknown, maxLen: number): string {
  if (typeof str !== 'string') return ''
  return str.trim().slice(0, maxLen)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// ─── Rate limiting simple en mémoire ─────────────────────────
// (Pour la production : remplacer par Upstash Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5          // max 5 tickets
const RATE_WINDOW = 15 * 60 * 1000 // par 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  // ── 1. Authentification ──────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // ── 2. Rate limiting ─────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
         ?? req.headers.get('x-real-ip')
         ?? user.id  // fallback sur user ID si pas d'IP
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Trop de demandes. Réessayez dans 15 minutes.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()

    // ── 3. Validation et sanitisation ────────────────────────────
    const ref         = sanitizeText(body.ref, 30)
    const subject     = sanitizeText(body.subject, 200)
    const message     = sanitizeText(body.message, 5000)
    const rawPriority = sanitizeText(body.priority, 10)
    const senderEmail = sanitizeText(body.senderEmail, 254)

    if (!subject) {
      return NextResponse.json({ error: 'Le sujet est requis' }, { status: 400 })
    }
    if (!message) {
      return NextResponse.json({ error: 'Le message est requis' }, { status: 400 })
    }

    // Valide la priorité contre une liste blanche
    const priority = ['low', 'medium', 'high'].includes(rawPriority) ? rawPriority : 'medium'

    // Valide le format email expéditeur (pas d'injection header)
    const validSenderEmail = EMAIL_RE.test(senderEmail) ? senderEmail : null

    // Vérifie que l'email correspond bien à l'utilisateur connecté
    if (validSenderEmail && validSenderEmail !== user.email) {
      return NextResponse.json({ error: 'Email expéditeur invalide' }, { status: 400 })
    }

    // ── 4. Email ─────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    const priorityLabel = PRIORITY_LABELS[priority] ?? priority
    const now = new Date().toLocaleString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouveau ticket support</title>
</head>
<body style="margin:0;padding:0;background:#0F1229;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1229;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1D2240,#161A34);border-radius:16px 16px 0 0;padding:32px 36px;border-bottom:1px solid rgba(107,174,229,0.15);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#4A5180;text-transform:uppercase;margin-bottom:8px;">NHBoost · Support</div>
                    <div style="font-size:22px;font-weight:800;color:#F0F2FF;line-height:1.2;">Nouveau ticket reçu</div>
                    <div style="font-size:13px;color:#8B95C4;margin-top:6px;">${escapeHtml(now)}</div>
                  </td>
                  <td align="right" valign="top">
                    <div style="background:rgba(106,174,229,0.12);border:1px solid rgba(106,174,229,0.25);border-radius:8px;padding:8px 14px;display:inline-block;">
                      <div style="font-size:11px;font-weight:700;color:#6AAEE5;letter-spacing:1px;">TICKET</div>
                      <div style="font-size:14px;font-weight:800;color:#F0F2FF;font-family:monospace;">${escapeHtml(ref) || '—'}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#161A34;padding:32px 36px;">

              <!-- Meta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="width:50%;padding-right:12px;">
                    <div style="background:#1D2240;border:1px solid rgba(107,174,229,0.1);border-radius:10px;padding:14px 16px;">
                      <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Priorité</div>
                      <div style="font-size:14px;font-weight:700;color:#F0F2FF;">${escapeHtml(priorityLabel)}</div>
                    </div>
                  </td>
                  <td style="width:50%;padding-left:12px;">
                    <div style="background:#1D2240;border:1px solid rgba(107,174,229,0.1);border-radius:10px;padding:14px 16px;">
                      <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Expéditeur</div>
                      <div style="font-size:14px;font-weight:700;color:#6AAEE5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(validSenderEmail ?? 'Non renseigné')}</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Subject -->
              <div style="margin-bottom:20px;">
                <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Sujet</div>
                <div style="font-size:17px;font-weight:700;color:#F0F2FF;line-height:1.4;">${escapeHtml(subject)}</div>
              </div>

              <!-- Message -->
              <div>
                <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Message</div>
                <div style="background:#1D2240;border:1px solid rgba(107,174,229,0.1);border-left:3px solid #6AAEE5;border-radius:0 10px 10px 0;padding:18px 20px;">
                  <div style="font-size:14px;color:#C8CFEE;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</div>
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1D2240;border-radius:0 0 16px 16px;padding:20px 36px;border-top:1px solid rgba(107,174,229,0.08);">
              <div style="font-size:12px;color:#4A5180;text-align:center;">
                Ce ticket a été créé automatiquement depuis le portail franchisé NHBoost.<br>
                Répondez à cet email pour contacter le franchisé directement.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    await transporter.sendMail({
      from:    `"NHBoost Support" <${process.env.GMAIL_USER}>`,
      to:      RECIPIENTS.join(', '),
      replyTo: validSenderEmail ?? undefined,  // email validé avant usage
      subject: `[${ref || 'TICKET'}] ${subject}`,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    // Ne pas exposer les détails d'erreur au client
    console.error('send-ticket error:', err)
    return NextResponse.json({ error: 'Une erreur est survenue. Réessayez.' }, { status: 500 })
  }
}
