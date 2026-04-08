import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// ─── Rate limiting ───────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
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

// ─── System prompt ───────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es le secrétaire IA de NHBoost, l'agence digitale de NH Group (SRL). Tu parles français, tu es professionnel mais chaleureux.

Tu aides les franchisés à créer des devis et des factures.

SERVICES DISPONIBLES :
| ID | Service | Prix HT |
|----|---------|---------|
| site-web | Création site web | 2 400 € |
| seo | Campagne SEO | 890 €/mois |
| logo | Refonte logo | 450 € |
| social | Pack réseaux sociaux | 320 €/mois |
| contenu | Rédaction de contenu | 200 € |
| ads | Publicité Google Ads | 500 €/mois |
| analytics | Rapport Analytics | 150 €/mois |
| identite | Kit communication | 350 € |

ÉMETTEUR : NH Group SRL — Belgique
TVA PAR DÉFAUT : 21%
VALIDITÉ DEVIS : 30 jours

FLOW DE CRÉATION DE DEVIS :
1. Comprends l'intention (nouveau devis, convertir en facture, question)
2. Collecte les infos client : nom (requis), email, téléphone, entreprise, n° TVA, adresse
3. Aide à sélectionner les services et quantités
4. Montre un récapitulatif texte avec sous-total HT, TVA 21%, total TTC
5. Demande confirmation explicite ("Confirmez-vous ?")

Quand l'utilisateur confirme EXPLICITEMENT, génère un bloc action JSON :

Pour créer un devis :
\`\`\`action
{"type":"create_devis","data":{"client_name":"...","client_email":"...","client_phone":"...","company_name":"...","vat_number":"...","client_address":"...","tva_rate":21,"discount":0,"notes":"...","items":[{"service_id":"site-web","description":"Création site web","quantity":1,"unit_price":2400}]}}
\`\`\`

Pour convertir un devis en facture :
\`\`\`action
{"type":"convert_to_facture","data":{"devis_id":"uuid-ici"}}
\`\`\`

RÈGLES STRICTES :
- Ne génère JAMAIS un bloc action sans confirmation EXPLICITE de l'utilisateur
- Toujours montrer le récapitulatif complet avant de demander confirmation
- Les prix sont HT, la TVA est calculée en plus
- Tu peux proposer des remises si le client le demande
- Sois concis et efficace, pas de bavardage inutile
- Si l'utilisateur demande "mes devis récents", dis-lui de consulter la liste (tu n'as pas accès)
- Pour la conversion en facture, tu as besoin de l'ID du devis`

// ─── POST handler ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans quelques minutes.' }, { status: 429 })
    }

    // API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API Anthropic non configurée' }, { status: 500 })
    }

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages requis' }, { status: 400 })
    }

    // Fetch user profile for personalization
    let franchiseName = 'Franchisé'
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, franchise_code')
      .eq('id', user.id)
      .single()
    if (profile?.company_name) franchiseName = profile.company_name
    else if (profile?.franchise_code) franchiseName = profile.franchise_code

    const personalizedSystem = `${SYSTEM_PROMPT}\n\nFRANCHISÉ ACTUEL : ${franchiseName} (${user.email})`

    // Test API key with a non-streaming call first
    const anthropic = new Anthropic({ apiKey })
    try {
      // Quick validation: just create the stream — if the key is invalid, it will throw on first iteration
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Clé API invalide'
      return NextResponse.json({ error: `Erreur Anthropic: ${msg}` }, { status: 500 })
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: personalizedSystem,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          })
          for await (const event of stream) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta as { type: string; text?: string }
              if (delta.type === 'text_delta' && delta.text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`))
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erreur de streaming'
          console.error('[chat] streaming error:', msg)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
