// ============================================================
// Stripe client singleton — serveur uniquement
// ============================================================
// ⚠ Ce fichier ne doit JAMAIS être importé côté client.
// STRIPE_SECRET_KEY ne doit pas fuiter dans le bundle.
// ============================================================

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    'STRIPE_SECRET_KEY manquant dans les variables d\'environnement. ' +
    'Ajoute-le dans .env.local (dev) et dans Vercel (prod).'
  )
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
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
