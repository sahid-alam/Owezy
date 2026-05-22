import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const MISTRAL_KEY       = Deno.env.get('MISTRAL_API_KEY')!
const LIMIT             = parseInt(Deno.env.get('AI_DAILY_LIMIT') ?? '20')
const WARN_AT           = parseInt(Deno.env.get('AI_DAILY_WARN_AT') ?? '16')
const TIMEOUT_MS        = 20_000

interface Item        { name: string; price: number; quantity: number }
interface Participant { id: string;   name: string }

function buildPrompt(items: Item[], description: string, participants: Participant[]): string {
  return `You are splitting a restaurant bill. Line items:
${JSON.stringify(items)}

Participants (use exact IDs in your response):
${participants.map(p => `- ${p.name} (id: "${p.id}")`).join('\n')}

Split description: "${description}"

Return ONLY a JSON object:
{
  "splits": [{
    "profile_id": string,
    "name": string,
    "items": [{ "item_name": string, "fraction": number, "amount": number }],
    "subtotal": number,
    "tax_share": number,
    "total": number
  }],
  "unattributed": [{ "name": string, "price": number }],
  "rounding_absorbed_by": string | null
}

Rules:
- For each item, fractions across all people must sum to exactly 1.0
- A person not mentioned for an item gets fraction 0.0 — omit them from that item's array
- Tax is distributed proportional to each person's subtotal share
- Rounding remainders (<=1 rupee total) absorbed by the person with the highest total; set rounding_absorbed_by to their profile_id
- "one third" = 0.333, "half" = 0.5, "rest"/"remaining" = 1.0 minus sum of explicit fractions
- Items not mentioned in description go into unattributed[]
- Return ONLY the JSON object`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
function jsonErr(status: number, code: string, message?: string) {
  return json({ error: code, message: message ?? code }, status)
}

async function callMistral(body: object, timeoutMs: number, retries = 2): Promise<unknown> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MISTRAL_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status === 429 && attempt < retries) {
      const wait = (parseInt(res.headers.get('Retry-After') ?? '1') + attempt) * 1000
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`)
    return await res.json()
  }
  throw new Error('Mistral rate limit exceeded after retries')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonErr(401, 'NOT_AUTHENTICATED')

    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: ue } = await sb.auth.getUser()
    if (ue || !user) return jsonErr(401, 'NOT_AUTHENTICATED')

    // 2. Rate limit
    const { data: count } = await sb.rpc('get_my_ai_usage_count')
    const usageCount = (count as number) ?? 0
    if (usageCount >= LIMIT) {
      return jsonErr(429, 'DAILY_LIMIT_REACHED', 'Daily AI limit reached. Try again tomorrow or use manual entry.')
    }

    // 3. Parse body
    const { items, description, participants } = await req.json()
    if (!items || !Array.isArray(items) || !description || !participants) {
      return jsonErr(422, 'MISSING_FIELDS', 'items, description, and participants required')
    }

    // 4. Call Mistral
    const prompt = buildPrompt(items as Item[], description as string, participants as Participant[])
    const result = await callMistral({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    }, TIMEOUT_MS) as { choices: { message: { content: string } }[] }

    const parsed = JSON.parse(result.choices[0].message.content)

    // 5. Log usage
    sb.from('ai_usage').insert({ profile_id: user.id, request_type: 'split' }).then(() => {})

    const newCount = usageCount + 1
    return json({
      ...parsed,
      _usage: { count: newCount, warn: newCount >= WARN_AT, limit: LIMIT },
    })
  } catch (e) {
    console.error('ai-split error:', e)
    return jsonErr(500, 'INTERNAL_ERROR', "Couldn't work out the split. Try re-describing or enter manually.")
  }
})
