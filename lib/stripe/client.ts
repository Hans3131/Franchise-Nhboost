// ============================================================
// Stripe client singleton — serveur uniquement
// ============================================================
// ⚠ Ce fichier ne doit JAMAIS être importé côté client.
// STRIPE_SECRET_KEY ne doit pas fuiter dans le bundle.
//
// Initialisation LAZY : l'instance Stripe n'est créée qu'au
// premier appel, pas à l'import du module. Cela évite que le
// build Vercel crashe quand une variable d'env manque
// (Next.js essaie de collecter les page data à l'import).
// ============================================================

import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Retourne l'instance Stripe singleton.
 * Lance une erreur claire si STRIPE_SECRET_KEY n'est pas configuré,
 * mais uniquement quand on essaie VRAIMENT de faire un appel
 * (pas à l'import du module).
 */
function getStripeClient(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY manquant dans les variables d\'environnement. ' +
        'Ajoute-le dans .env.local (dev) et dans Vercel (prod).',
    )
  }
  _stripe = new Stripe(key, { typescript: true })
  return _stripe
}

/**
 * Proxy qui forward toutes les propriétés à l'instance lazy.
 * Permet à `stripe.checkout.sessions.create(...)` de fonctionner
 * normalement sans faire crasher l'import du module.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripeClient()
    const value = Reflect.get(client, prop, receiver)
    // Bind les fonctions au client réel pour préserver `this`
    return typeof value === 'function' ? value.bind(client) : value
  },
})

/**
 * Retourne l'URL de base du site pour construire les success_url / cancel_url.
 * Ordre de priorité :
 *   1. NEXT_PUBLIC_APP_URL (config manuelle)
 *   2. VERCEL_URL (auto sur Vercel)
 *   3. http://localhost:3000 (fallback dev)
 */
export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`

  return 'http://localhost:3000'
}
