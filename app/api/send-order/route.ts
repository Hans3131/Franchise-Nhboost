import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'

// ─── Destinataires fixes ─────────────────────────────────────
const RECIPIENTS = ['nhboostpro@gmail.com', 'hansyapo0@gmail.com']

// ─── Limites de sécurité ──────────────────────────────────────
const MAX_FILE_SIZE     = 10 * 1024 * 1024  // 10 MB par fichier
const MAX_TOTAL_SIZE    = 50 * 1024 * 1024  // 50 MB total
const MAX_FILES         = 10
const MAX_BRIEF_LEN     = 5000
const MAX_FIELD_LEN     = 300

// Types de fichiers autorisés (whitelist stricte)
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

// ─── Types ───────────────────────────────────────────────────
interface FilePayload {
  name: string
  type: string
  size: number
  data: string   // base64
}

// ─── Validation ───────────────────────────────────────────────
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

function sanitize(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return ''
  return val.trim().slice(0, maxLen)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// ─── Rate limiting en mémoire ─────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT  = 10
const RATE_WINDOW = 60 * 60 * 1000  // 1 heure

function checkRateLimit(key: string): boolean {
  const now   = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

function isImage(file: FilePayload) {
  return IMAGE_TYPES.includes(file.type.toLowerCase())
}

function formatBytes(bytes: number) {
  if (bytes < 1024)       return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ─── Génération du PDF ────────────────────────────────────────
async function generateBriefPDF(
  order: Record<string, string | number>,
  files: FilePayload[],
): Promise<Buffer> {
  // ── Pré-traitement des images (async, avant la Promise PDFKit) ─
  const jpegBuffers = new Map<string, Buffer>()
  for (const file of files.filter(isImage)) {
    try {
      const srcBuf = Buffer.from(file.data, 'base64')
      const jpegBuf = await sharp(srcBuf).jpeg({ quality: 85 }).toBuffer()
      jpegBuffers.set(file.name, jpegBuf)
    } catch {
      // image invalide, ignorée dans le PDF
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ margin: 50, size: 'A4' })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ── Palette ─────────────────────────────────────────────
    const NAVY   = '#0F1229'
    const BLUE   = '#6AAEE5'
    const DARK   = '#161A34'
    const MUTED  = '#8B95C4'
    const WHITE  = '#F0F2FF'
    const GREEN  = '#22C55E'
    const PURPLE = '#8B5CF6'
    const AMBER  = '#F59E0B'

    // ── Header bandeau ───────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill(DARK)

    doc.circle(65, 45, 20).fill(BLUE)
    doc.fontSize(14).fillColor(WHITE).font('Helvetica-Bold')
       .text('NH', 55, 38)

    doc.fontSize(20).fillColor(WHITE).font('Helvetica-Bold')
       .text('NHBoost', 95, 30)
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text('PORTAIL FRANCHISÉ', 95, 55)

    doc.fontSize(10).fillColor(BLUE).font('Helvetica-Bold')
       .text('BRIEF TECHNIQUE', 0, 35, { align: 'right', width: doc.page.width - 50 })
    doc.fontSize(8).fillColor(MUTED).font('Helvetica')
       .text(String(order.ref ?? ''), 0, 52, { align: 'right', width: doc.page.width - 50 })

    doc.moveDown(2)

    // ── Titre principal ─────────────────────────────────────
    const titleY = 110
    doc.fontSize(18).fillColor(NAVY).font('Helvetica-Bold')
       .text('Brief Technique', 50, titleY)
    doc.fontSize(11).fillColor(MUTED).font('Helvetica')
       .text(
         `${order.franchiseeName ?? 'Franchisé'} — ${order.companyName || order.clientName || ''}`,
         50, titleY + 26
       )

    doc.moveTo(50, titleY + 48).lineTo(doc.page.width - 50, titleY + 48)
       .lineWidth(1).strokeColor(BLUE).stroke()

    doc.fontSize(8).fillColor(MUTED).font('Helvetica')
       .text(
         `Émis le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}   ·   ${order.service ?? ''}`,
         50, titleY + 56
       )

    doc.y = titleY + 80

    // ── Helpers ─────────────────────────────────────────────
    const section = (title: string, color = BLUE) => {
      // nouvelle page si moins de 100px restants
      if (doc.y > doc.page.height - 120) doc.addPage()
      doc.moveDown(0.5)
      const sy = doc.y
      doc.rect(50, sy, 4, 16).fill(color)
      doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold')
         .text(title.toUpperCase(), 62, sy + 2)
      doc.moveDown(0.6)
    }

    const row = (label: string, value: string | number, highlight = false) => {
      if (!value) return
      const y = doc.y
      doc.fontSize(8).fillColor(MUTED).font('Helvetica')
         .text(label, 62, y, { width: 130, continued: false })
      doc.fontSize(9).fillColor(highlight ? BLUE : '#1A1F3D').font('Helvetica-Bold')
         .text(String(value), 200, y, { width: doc.page.width - 250 })
      doc.moveDown(0.5)
    }

    const block = (label: string, value: string, borderColor = BLUE) => {
      if (!value) return
      if (doc.y > doc.page.height - 140) doc.addPage()
      doc.moveDown(0.3)
      doc.fontSize(8).fillColor(MUTED).font('Helvetica-Bold')
         .text(label.toUpperCase(), 62)
      doc.moveDown(0.2)
      const bx = 62, by = doc.y, bw = doc.page.width - 112
      const lines = doc.heightOfString(value, { width: bw - 20 })
      doc.rect(bx, by, bw, lines + 16).fill('#F4F6FF')
      doc.rect(bx, by, 3, lines + 16).fill(borderColor)
      doc.fontSize(9).fillColor('#2A2F50').font('Helvetica')
         .text(value, bx + 12, by + 8, { width: bw - 20 })
      doc.y = by + lines + 24
      doc.moveDown(0.2)
    }

    // ── Section 1 : Informations commande ───────────────────
    section('Informations commande')
    row('Référence',    order.ref    ?? '—')
    row('Service',      order.service ?? '—')
    row('Montant',      `€${Number(order.price ?? 0).toLocaleString('fr-FR')}`, true)
    row('Statut',       'En attente de traitement')
    row('Date',         new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }))

    // ── Section 2 : Contact client ──────────────────────────
    section('Contact client')
    row('Nom client',   order.clientName  ?? '—')
    row('Email client', order.clientEmail ?? '—')
    if (order.clientPhone) row('Téléphone', order.clientPhone)

    // ── Section 3 : Entreprise ──────────────────────────────
    if (order.companyName || order.sector) {
      section('Entreprise')
      if (order.companyName)  row("Nom de l'entreprise", order.companyName)
      if (order.companyEmail) row('Email entreprise',    order.companyEmail)
      if (order.sector)       row("Secteur d'activité",  order.sector)
    }

    // ── Section 4 : Projet ──────────────────────────────────
    section('Description du projet', PURPLE)
    block('Description / Brief', String(order.brief ?? ''), PURPLE)

    if (order.objectives) {
      block('Objectifs', String(order.objectives), GREEN)
    }

    if (order.requiredAccess) {
      block('Accès nécessaires', String(order.requiredAccess), AMBER)
    }

    // ── Section 5 : Fichiers joints ─────────────────────────
    if (files.length > 0) {
      section('Fichiers & assets joints', AMBER)

      // Liste de tous les fichiers
      for (const file of files) {
        if (doc.y > doc.page.height - 60) doc.addPage()
        const y = doc.y
        const icon = isImage(file) ? '🖼' : '📄'
        doc.fontSize(8).fillColor(MUTED).font('Helvetica')
           .text(`${icon}  ${file.name}`, 66, y, { width: doc.page.width - 150, continued: false })
        doc.fontSize(8).fillColor('#4A5180').font('Helvetica')
           .text(formatBytes(file.size), doc.page.width - 130, y, { width: 80, align: 'right' })
        doc.moveDown(0.5)
      }

      // Images : convertir en JPEG via sharp puis insérer dans le PDF
      const images = files.filter(isImage)
      if (images.length > 0) {
        doc.moveDown(0.5)
        doc.fontSize(8).fillColor(MUTED).font('Helvetica-Bold')
           .text('APERÇU DES IMAGES', 62)
        doc.moveDown(0.4)

        for (const img of images) {
          const jpegBuf = jpegBuffers.get(img.name)
          if (!jpegBuf) continue
          try {
            if (doc.y > doc.page.height - 200) doc.addPage()
            const maxW = doc.page.width - 124
            const maxH = 220
            doc.image(jpegBuf, 62, doc.y, { fit: [maxW, maxH], align: 'center' })
            doc.moveDown(0.4)
            doc.fontSize(7).fillColor(MUTED).font('Helvetica')
               .text(img.name, 62, doc.y, { align: 'center', width: maxW })
            doc.moveDown(0.8)
          } catch {
            // image non supportée, on l'ignore dans le PDF
          }
        }
      }
    }

    // ── Footer ───────────────────────────────────────────────
    const footerY = doc.page.height - 50
    doc.rect(0, footerY - 8, doc.page.width, 58).fill(DARK)
    doc.fontSize(7).fillColor(MUTED).font('Helvetica')
       .text(
         `Document généré automatiquement par NHBoost · ${new Date().toLocaleDateString('fr-FR')} · Confidentiel`,
         50, footerY + 5, { align: 'center', width: doc.page.width - 100 }
       )

    doc.end()
  })
}

// ─── Route POST ───────────────────────────────────────────────
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
         ?? user.id
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Trop de commandes. Réessayez dans une heure.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()

    // ── 3. Validation et sanitisation ────────────────────────────
    const ref             = sanitize(body.ref, 30)
    const service         = sanitize(body.service, MAX_FIELD_LEN)
    const clientName      = sanitize(body.clientName, MAX_FIELD_LEN)
    const clientEmail     = sanitize(body.clientEmail, 254)
    const clientPhone     = sanitize(body.clientPhone, 30)
    const companyName     = sanitize(body.companyName, MAX_FIELD_LEN)
    const companyEmail    = sanitize(body.companyEmail, 254)
    const sector          = sanitize(body.sector, MAX_FIELD_LEN)
    const brief           = sanitize(body.brief, MAX_BRIEF_LEN)
    const objectives      = sanitize(body.objectives, MAX_BRIEF_LEN)
    const requiredAccess  = sanitize(body.requiredAccess, MAX_BRIEF_LEN)
    const franchiseeName  = sanitize(body.franchiseeName, MAX_FIELD_LEN)
    const price           = typeof body.price === 'number' && body.price >= 0 && body.price < 1_000_000
                              ? body.price : 0

    if (!clientName || !service) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    // Valide email client
    if (clientEmail && !EMAIL_RE.test(clientEmail)) {
      return NextResponse.json({ error: 'Email client invalide' }, { status: 400 })
    }

    // ── 4. Validation des fichiers ────────────────────────────────
    const rawFiles: FilePayload[] = Array.isArray(body.files) ? body.files : []

    if (rawFiles.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} fichiers autorisés` }, { status: 400 })
    }

    let totalSize = 0
    const files: FilePayload[] = []

    for (const f of rawFiles) {
      if (typeof f.data !== 'string' || typeof f.name !== 'string' || typeof f.type !== 'string') continue

      // Whitelist des types MIME
      const mime = f.type.toLowerCase()
      if (!ALLOWED_MIME_TYPES.has(mime)) {
        return NextResponse.json(
          { error: `Type de fichier non autorisé : ${f.name}` },
          { status: 400 }
        )
      }

      // Taille réelle depuis base64
      const realSize = Math.round((f.data.length * 3) / 4)
      if (realSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Fichier trop volumineux : ${f.name} (max 10 MB)` },
          { status: 400 }
        )
      }

      totalSize += realSize
      if (totalSize > MAX_TOTAL_SIZE) {
        return NextResponse.json({ error: 'Volume total des fichiers trop important (max 50 MB)' }, { status: 400 })
      }

      // Sanitise le nom du fichier
      const safeName = f.name.replace(/[^a-zA-Z0-9._\- ]/g, '_').slice(0, 200)
      files.push({ ...f, name: safeName })
    }

    // ── 5. Génération PDF ─────────────────────────────────────
    const pdfBuffer = await generateBriefPDF(
      {
        ref, service, price,
        clientName, clientEmail, clientPhone,
        companyName, companyEmail, sector,
        brief, objectives, requiredAccess,
        franchiseeName: franchiseeName || 'Franchisé',
      },
      files,
    )

    const pdfFileName = `Brief_Technique_${franchiseeName || 'Franchisé'}_${companyName || clientName}_${ref}.pdf`
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')

    // ── 6. Email HTML ─────────────────────────────────────────
    const filesListHtml = files.length > 0
      ? `<div style="margin-bottom:20px;">
          <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Fichiers joints (${files.length})</div>
          ${files.map((f: FilePayload) => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#1D2240;border-radius:8px;margin-bottom:4px;">
              <span style="font-size:13px;">${isImage(f) ? '🖼️' : '📄'}</span>
              <span style="font-size:12px;color:#C8CFEE;flex:1;">${escapeHtml(f.name)}</span>
              <span style="font-size:11px;color:#4A5180;">${formatBytes(f.size)}</span>
            </div>`).join('')}
        </div>`
      : ''

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0F1229;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F1229;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1D2240,#161A34);border-radius:16px 16px 0 0;padding:32px 36px;border-bottom:1px solid rgba(107,174,229,0.15);">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#4A5180;text-transform:uppercase;margin-bottom:8px;">NHBoost · Nouvelle commande</div>
              <div style="font-size:22px;font-weight:800;color:#F0F2FF;">Brief Technique reçu</div>
              <div style="font-size:13px;color:#8B95C4;margin-top:6px;">${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </td>
            <td align="right" valign="top">
              <div style="background:rgba(106,174,229,0.12);border:1px solid rgba(106,174,229,0.25);border-radius:8px;padding:8px 14px;display:inline-block;">
                <div style="font-size:11px;font-weight:700;color:#6AAEE5;letter-spacing:1px;">COMMANDE</div>
                <div style="font-size:14px;font-weight:800;color:#F0F2FF;font-family:monospace;">${escapeHtml(ref)}</div>
              </div>
            </td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#161A34;padding:32px 36px;">
          <!-- Résumé -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="width:50%;padding-right:12px;">
                <div style="background:#1D2240;border:1px solid rgba(107,174,229,0.1);border-radius:10px;padding:14px 16px;">
                  <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Service</div>
                  <div style="font-size:14px;font-weight:700;color:#F0F2FF;">${escapeHtml(service)}</div>
                </div>
              </td>
              <td style="width:50%;padding-left:12px;">
                <div style="background:#1D2240;border:1px solid rgba(107,174,229,0.1);border-radius:10px;padding:14px 16px;">
                  <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Montant</div>
                  <div style="font-size:18px;font-weight:800;color:#6AAEE5;font-family:monospace;">€${Number(price).toLocaleString('fr-FR')}</div>
                </div>
              </td>
            </tr>
          </table>

          <!-- Client -->
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Contact client</div>
            <div style="font-size:14px;color:#C8CFEE;">${escapeHtml(clientName)} &nbsp;·&nbsp; ${escapeHtml(clientEmail)}${clientPhone ? ' &nbsp;·&nbsp; ' + escapeHtml(clientPhone) : ''}</div>
          </div>

          ${companyName ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Entreprise</div>
            <div style="font-size:14px;color:#C8CFEE;">${escapeHtml(companyName)}${sector ? ' &nbsp;·&nbsp; ' + escapeHtml(sector) : ''}${companyEmail ? '<br><span style="font-size:12px;color:#8B95C4;">' + escapeHtml(companyEmail) + '</span>' : ''}</div>
          </div>` : ''}

          <!-- Brief -->
          ${brief ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Brief / Description</div>
            <div style="background:#1D2240;border-left:3px solid #8B5CF6;border-radius:0 10px 10px 0;padding:14px 16px;">
              <div style="font-size:13px;color:#C8CFEE;line-height:1.7;white-space:pre-wrap;">${escapeHtml(brief)}</div>
            </div>
          </div>` : ''}

          <!-- Objectifs -->
          ${objectives ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Objectifs</div>
            <div style="background:#1D2240;border-left:3px solid #22C55E;border-radius:0 10px 10px 0;padding:14px 16px;">
              <div style="font-size:13px;color:#C8CFEE;line-height:1.7;white-space:pre-wrap;">${escapeHtml(objectives)}</div>
            </div>
          </div>` : ''}

          <!-- Accès -->
          ${requiredAccess ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:10px;font-weight:700;color:#4A5180;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Accès nécessaires</div>
            <div style="background:#1D2240;border-left:3px solid #F59E0B;border-radius:0 10px 10px 0;padding:14px 16px;">
              <div style="font-size:13px;color:#C8CFEE;line-height:1.7;white-space:pre-wrap;">${escapeHtml(requiredAccess)}</div>
            </div>
          </div>` : ''}

          <!-- Fichiers -->
          ${filesListHtml}

          <!-- Note PDF -->
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:14px 16px;">
            <div style="font-size:13px;color:#22C55E;font-weight:600;">📎 Le brief technique complet (avec images) est joint en PDF à cet email.${files.length > 0 ? ` Les ${files.length} fichier${files.length > 1 ? 's' : ''} uploadé${files.length > 1 ? 's' : ''} sont également joints.` : ''}</div>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#1D2240;border-radius:0 0 16px 16px;padding:20px 36px;border-top:1px solid rgba(107,174,229,0.08);">
          <div style="font-size:12px;color:#4A5180;text-align:center;">
            Document confidentiel généré automatiquement par NHBoost.<br>
            Franchisé : ${escapeHtml(franchiseeName)}
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    // ── Pièces jointes : PDF brief + tous les fichiers uploadés
    const attachments: nodemailer.SendMailOptions['attachments'] = [
      {
        filename:    pdfFileName,
        content:     pdfBuffer,
        contentType: 'application/pdf',
      },
      // Ajouter chaque fichier uploadé
      ...files.map((f: FilePayload) => ({
        filename:    f.name,
        content:     Buffer.from(f.data, 'base64'),
        contentType: f.type || 'application/octet-stream',
      })),
    ]

    // ── Envoi email ─────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    await transporter.sendMail({
      from:    `"NHBoost" <${process.env.GMAIL_USER}>`,
      to:      RECIPIENTS.join(', '),
      subject: `[${ref}] Brief Technique — ${franchiseeName ?? 'Franchisé'} — ${companyName || clientName}`,
      html,
      attachments,
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    // Ne pas exposer les détails d'erreur au client (fuite d'infos système)
    console.error('send-order error:', err)
    return NextResponse.json({ error: 'Une erreur est survenue. Réessayez.' }, { status: 500 })
  }
}
