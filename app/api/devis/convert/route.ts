import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { devisId } = await req.json()
    if (!devisId) return NextResponse.json({ error: 'devisId requis' }, { status: 400 })

    // Fetch devis
    const { data: devis, error: devisError } = await supabase
      .from('devis')
      .select('*')
      .eq('id', devisId)
      .eq('user_id', user.id)
      .single()
    if (devisError || !devis) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 })
    }
    if (devis.status === 'invoiced') {
      return NextResponse.json({ error: 'Ce devis a déjà été converti en facture' }, { status: 400 })
    }

    // Fetch devis items
    const { data: devisItems } = await supabase
      .from('devis_items')
      .select('*')
      .eq('devis_id', devisId)
      .order('sort_order', { ascending: true })

    // Create facture
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const { data: facture, error: factureError } = await supabase
      .from('factures')
      .insert({
        user_id:        user.id,
        devis_id:       devisId,
        client_name:    devis.client_name,
        client_email:   devis.client_email,
        client_phone:   devis.client_phone,
        company_name:   devis.company_name,
        company_email:  devis.company_email,
        vat_number:     devis.vat_number,
        client_address: devis.client_address,
        subtotal_ht:    devis.subtotal_ht,
        tva_rate:       devis.tva_rate,
        tva_amount:     devis.tva_amount,
        total_ttc:      devis.total_ttc,
        discount:       devis.discount,
        status:         'unpaid',
        due_date:       dueDate.toISOString().split('T')[0],
        notes:          devis.notes,
      })
      .select()
      .single()

    if (factureError || !facture) {
      return NextResponse.json({ error: 'Erreur lors de la création de la facture' }, { status: 500 })
    }

    // Copy items
    if (devisItems && devisItems.length > 0) {
      await supabase.from('facture_items').insert(
        devisItems.map((item: Record<string, unknown>) => ({
          facture_id:  facture.id,
          service_id:  item.service_id,
          description: item.description,
          quantity:    item.quantity,
          unit_price:  item.unit_price,
          total:       item.total,
          sort_order:  item.sort_order,
        }))
      )
    }

    // Update devis status
    await supabase
      .from('devis')
      .update({ status: 'invoiced', facture_id: facture.id })
      .eq('id', devisId)

    // Fetch facture items
    const { data: factureItems } = await supabase
      .from('facture_items')
      .select('*')
      .eq('facture_id', facture.id)
      .order('sort_order', { ascending: true })

    return NextResponse.json({
      ok: true,
      facture: { ...facture, items: factureItems ?? [] },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
