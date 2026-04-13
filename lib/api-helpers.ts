// ============================================================
// api-helpers — Utilitaires de sécurité pour les API routes
// ============================================================

/**
 * Échappe les caractères HTML dangereux pour éviter les XSS
 * dans les templates email ou les réponses HTML.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Nettoie un input : trim + limite de longueur.
 * Retourne une string vide si l'input n'est pas une string.
 */
export function sanitize(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return ''
  return val.trim().slice(0, maxLen)
}

/**
 * Masque un message d'erreur Supabase pour ne pas exposer
 * la structure de la DB au client. Logue le message original.
 */
export function safeError(
  context: string,
  error: { message?: string; code?: string; details?: string } | null,
  publicMessage = 'Erreur serveur',
): string {
  if (error) {
    console.error(`[${context}] ${error.message}`, error.details ?? '')
  }
  return publicMessage
}

/** Regex email basique mais solide */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
