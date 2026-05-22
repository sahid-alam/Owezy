import { supabase } from './supabase.js'

// Provider abstraction — all AI calls go through Edge Functions.
// Swap provider by changing the edge function implementations only; feature code never changes.

/**
 * @param {string} storagePath  — path in the receipts bucket, e.g. "{userId}/draft-{ts}.jpg"
 * @returns {Promise<{ items: Array<{name:string,price:number,quantity:number}>, total: number, tax_amount: number, confidence: string, _usage: object }>}
 */
export async function ocr(storagePath) {
  return callFunction('ai-ocr', { storagePath })
}

/**
 * @param {{ items: Array, description: string, participants: Array<{id:string,name:string}> }} params
 * @returns {Promise<{ splits: Array, unattributed: Array, rounding_absorbed_by: string|null, _usage: object }>}
 */
export async function parseSplit({ items, description, participants }) {
  return callFunction('ai-split', { items, description, participants })
}

/**
 * @param {{ transcript: string, context: { selfId: string, selfName: string, friends: Array } }} params
 * @returns {Promise<{ title: string, amount: number, paid_by_id: string|null, participant_ids: string[], split_type: string, confidence: string, _usage: object }>}
 */
export async function parseQuickAdd({ transcript, context }) {
  return callFunction('ai-quick-add', { transcript, context })
}

/**
 * @param {number} [hours=24]
 * @returns {Promise<number>}
 */
export async function getMyUsageCount(hours = 24) {
  const { data, error } = await supabase.rpc('get_my_ai_usage_count', { p_hours: hours })
  if (error) throw error
  return data ?? 0
}

async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('NOT_AUTHENTICATED')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`
  const res  = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'UNKNOWN' }))
    const e   = new Error(err.message ?? err.error ?? 'AI request failed')
    e.code    = err.error
    e.status  = res.status
    throw e
  }

  return res.json()
}
