import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createClient } from '@/lib/supabase/server'

const NAVY = '#0F1229'
const BLUE = '#6AAEE5'
const DARK = '#161A34'
const MUTED = '#8B95C4'
const WHITE = '#FFFFFF'

function generatePdf(facture: Record<string, unknown>, items: Record<string, unknown>[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width - 100

    // ── Header ──────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(NAVY)
    doc.fontSize(24).font('Helvetica-Bold').fillColor(WHITE)
       .text('FACTURE', 50, 28, { width: W / 2 })
    doc.fontSize(10).font('Helvetica').fillColor(BLUE)
       .text(String(facture.ref ?? ''), 50 + W / 2, 28, { width: W / 2, align: 'right' })
    doc.fontSize(9).fillColor(MUTED)
       .text(new Date(String(facture.created_at)).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
         50 + W / 2, 46, { width: W / 2, align: 'right' })

    let y = 100
    const colW = W / 2 - 10

    // ── Émetteur ────────────────────────────────────────
    doc.fontSize(8).font('Helvetica-Bold').fillColor(MUTED).text('ÉMETTEUR', 50, y)
    y += 14
    doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text('NH Group SRL', 50, y)
    y += 14
    doc.fontSize(9).font('Helvetica').fillColor(DARK).text('Belgique', 50, y)
    y += 12
    doc.text('contact@nhboost.com', 50, y)

    // ── Client ──────────────────────────────────────────
    let cy = 100
    doc.fontSize(8).font('Helvetica-Bold').fillColor(MUTED).text('CLIENT', 50 + colW + 20, cy)
    cy += 14
    doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text(String(facture.client_name ?? ''), 50 + colW + 20, cy, { width: colW })
    cy += 14
    if (facture.company_name) { doc.fontSize(9).font('Helvetica').fillColor(DARK).text(String(facture.company_name), 50 + colW + 20, cy, { width: colW }); cy += 12 }
    if (facture.client_email) { doc.text(String(facture.client_email), 50 + colW + 20, cy, { width: colW }); cy += 12 }
    if (facture.client_phone) { doc.text(String(facture.client_phone), 50 + colW + 20, cy, { width: colW }); cy += 12 }
    if (facture.vat_number)   { doc.text(`TVA: ${facture.vat_number}`, 50 + colW + 20, cy, { width: colW }); cy += 12 }

    y = Math.max(y, cy) + 30

    // ── Statut + échéance ───────────────────────────────
    const statusLabels: Record<string, string> = { unpaid: 'Non payée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' }
    const statusColors: Record<string, string> = { unpaid: '#F59E0B', paid: '#22C55E', overdue: '#EF4444', cancelled: '#8B95C4' }
    const status = String(facture.status ?? 'unpaid')
    doc.fontSize(9).font('Helvetica-Bold').fillColor(statusColors[status] ?? MUTED)
       .text(`Statut : ${statusLabels[status] ?? status}`, 50, y)
    if (facture.due_date) {
      doc.font('Helvetica').fillColor(DARK)
         .text(` — Échéance : ${new Date(String(facture.due_date)).toLocaleDateString('fr-FR')}`, 200, y)
    }
    y += 20

    // ── Separator ───────────────────────────────────────
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor(BLUE).lineWidth(0.5).stroke()
    y += 20

    // ── Table ───────────────────────────────────────────
    const cols = [
      { label: '#',             x: 50,        w: 30  },
      { label: 'Description',   x: 80,        w: W - 220 },
      { label: 'Qté',           x: W - 140,   w: 40  },
      { label: 'Prix unit. HT', x: W - 100,   w: 70  },
      { label: 'Total HT',      x: W - 30,    w: 80  },
    ]

    doc.rect(50, y, W, 22).fill('#F0F2FF')
    doc.fontSize(8).font('Helvetica-Bold').fillColor(NAVY)
    cols.forEach(col => doc.text(col.label, col.x, y + 6, { width: col.w, align: col.label === '#' ? 'center' : 'left' }))
    y += 28

    items.forEach((item, i) => {
      if (y > 700) { doc.addPage(); y = 50 }
      const bg = i % 2 === 0 ? WHITE : '#F8F9FC'
      doc.rect(50, y, W, 20).fill(bg)
      doc.fontSize(9).font('Helvetica').fillColor(DARK)
      doc.text(String(i + 1), cols[0].x, y + 5, { width: cols[0].w, align: 'center' })
      doc.text(String(item.description ?? ''), cols[1].x, y + 5, { width: cols[1].w })
      doc.text(String(item.quantity ?? 1), cols[2].x, y + 5, { width: cols[2].w, align: 'center' })
      doc.text(`€${Number(item.unit_price ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`, cols[3].x, y + 5, { width: cols[3].w, align: 'right' })
      doc.font('Helvetica-Bold').text(`€${Number(item.total ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`, cols[4].x, y + 5, { width: cols[4].w, align: 'right' })
      y += 22
    })

    y += 15

    // ── Totals ──────────────────────────────────────────
    const totX = W - 80
    const discount = Number(facture.discount ?? 0)

    doc.fontSize(9).font('Helvetica').fillColor(DARK)
       .text('Sous-total HT', totX, y, { width: 100 })
       .text(`€${Number(facture.subtotal_ht ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`, totX + 100, y, { width: 80, align: 'right' })
    y += 16

    if (discount > 0) {
      doc.fillColor('#EF4444')
         .text('Remise', totX, y, { width: 100 })
         .text(`-€${discount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`, totX + 100, y, { width: 80, align: 'right' })
      y += 16
      doc.fillColor(DARK)
    }

    doc.text(`TVA ${facture.tva_rate ?? 21}%`, totX, y, { width: 100 })
       .text(`€${Number(facture.tva_amount ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`, totX + 100, y, { width: 80, align: 'right' })
    y += 18

    doc.moveTo(totX, y).lineTo(totX + 180, y).strokeColor(NAVY).lineWidth(1).stroke()
    y += 8

    doc.fontSize(12).font('Helvetica-Bold').fillColor(NAVY)
       .text('Total TTC', totX, y, { width: 100 })
       .text(`€${Number(facture.total_ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`, totX + 100, y, { width: 80, align: 'right' })
    y += 30

    // ── Notes ───────────────────────────────────────────
    if (facture.notes) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(MUTED).text('NOTES', 50, y)
      y += 12
      doc.fontSize(9).font('Helvetica').fillColor(DARK).text(String(facture.notes), 50, y, { width: W })
    }

    // ── Footer ──────────────────────────────────────────
    const footerY = doc.page.height - 40
    doc.rect(0, footerY - 10, doc.page.width, 50).fill(NAVY)
    doc.fontSize(7).font('Helvetica').fillColor(MUTED)
       .text('Document généré par NHBoost — NH Group SRL — Confidentiel', 50, footerY, { width: W, align: 'center' })

    doc.end()
  })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { factureId } = await req.json()
    if (!factureId) return NextResponse.json({ error: 'factureId requis' }, { status: 400 })

    const { data: facture, error } = await supabase
      .from('factures')
      .select('*')
      .eq('id', factureId)
      .eq('user_id', user.id)
      .single()
    if (error || !facture) return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })

    const { data: items } = await supabase
      .from('facture_items')
      .select('*')
      .eq('facture_id', factureId)
      .order('sort_order', { ascending: true })

    const pdf = await generatePdf(facture, items ?? [])

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${facture.ref}.pdf"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
