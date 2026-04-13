// ============================================================
// Rate limiter in-memory — compatible serverless (best-effort)
// ============================================================
// Pour une solution persistante en prod, migrer vers Upstash Redis.
// Ce limiter protège tout de même contre les rafales depuis un
// même user dans une même instance serverless.
// ============================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup toutes les 60s pour éviter les fuites mémoire
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

/**
 * Vérifie si une requête est autorisée par le rate limiter.
 * @param key - Clé unique (ex: `payment:${user.id}`)
 * @param maxRequests - Nombre max de requêtes autorisées
 * @param windowMs - Fenêtre de temps en millisecondes
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  cleanup()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // Nouvelle fenêtre
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  entry.count += 1
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}

/**
 * Helper pour les API routes : retourne une Response 429 si rate limited.
 * Usage : const blocked = checkRateLimit('payment', user.id, 5, 60_000); if (blocked) return blocked;
 */
export function checkRateLimit(
  prefix: string,
  userId: string,
  maxRequests: number,
  windowMs: number,
): Response | null {
  const { allowed, remaining, resetAt } = rateLimit(`${prefix}:${userId}`, maxRequests, windowMs)

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Trop de requêtes. Réessayez dans quelques instants.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  return null // allowed
}
