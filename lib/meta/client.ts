// ============================================================
// Meta Graph API client — récupération des leads Facebook
// ============================================================
// Pas de dépendance externe : fetch natif (Node 20+)
// ============================================================

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// ─── Types ────────────────────────────────────────────────────

interface MetaFieldData {
  name: string
  values: string[]
}

interface MetaLeadResponse {
  id: string
  created_time: string
  field_data: MetaFieldData[]
  ad_id?: string
  form_id?: string
}

export interface ParsedFbLead {
  name: string | null
  email: string | null
  phone: string | null
  company: string | null
  rawFieldData: MetaFieldData[]
}

export interface FetchLeadResult {
  parsed: ParsedFbLead
  raw: MetaLeadResponse
}

// ─── Fetch lead complet depuis Graph API ──────────────────────

export async function fetchLeadData(
  leadgenId: string,
  accessToken: string,
): Promise<FetchLeadResult> {
  const url = `${GRAPH_BASE_URL}/${encodeURIComponent(leadgenId)}?` +
    `access_token=${encodeURIComponent(accessToken)}&` +
    `fields=field_data,created_time,ad_id,form_id`

  const res = await fetch(url)

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Meta Graph API error ${res.status}: ${body.slice(0, 500)}`)
  }

  const data: MetaLeadResponse = await res.json()
  return {
    parsed: parseFieldData(data.field_data ?? []),
    raw: data,
  }
}

// ─── Parser : field_data[] → objet structuré ─────────────────
// Meta renvoie les champs du formulaire dans un format non-standard :
// [{ name: "full_name", values: ["Jean Dupont"] }, ...]
// On mappe vers des champs plats (name, email, phone, company)

function parseFieldData(fields: MetaFieldData[]): ParsedFbLead {
  const map = new Map<string, string>()
  for (const f of fields) {
    const key = f.name.toLowerCase().replace(/\s+/g, '_')
    const val = f.values?.[0]
    if (val) map.set(key, val)
  }

  return {
    name:
      map.get('full_name') ??
      map.get('name') ??
      map.get('first_name')
        ? [map.get('first_name'), map.get('last_name')].filter(Boolean).join(' ') || null
        : null,
    email:
      map.get('email') ??
      map.get('work_email') ??
      null,
    phone:
      map.get('phone_number') ??
      map.get('phone') ??
      map.get('mobile_number') ??
      null,
    company:
      map.get('company_name') ??
      map.get('company') ??
      map.get('work_company') ??
      null,
    rawFieldData: fields,
  }
}

// ─── Signature verification ───────────────────────────────────
// Meta signe les webhooks avec HMAC-SHA256 en utilisant l'App Secret

import { createHmac, timingSafeEqual } from 'crypto'

export function verifyMetaSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature) return false

  const expected =
    'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    )
  } catch {
    return false
  }
}
