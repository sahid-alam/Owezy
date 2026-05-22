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
const TIMEOUT_MS        = 15_000

interface Person  { id: string; name: string }
interface Context { selfId: string; selfName: string; friends: Person[] }

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function resolveName(raw: string, context: Context): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower === 'i' || lower === 'me' || lower === 'self') return context.selfId
  const all: Person[] = [{ id: context.selfId, name: context.selfName }, ...context.friends]
  // Exact or partial match first
  const exact = all.find(p => p.name.toLowerCase() === lower)
  if (exact) return exact.id
  const partial = all.find(p =>
    p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase().split(' ')[0])
  )
  if (partial) return partial.id
  // Levenshtein fallback — accept if distance ≤ 2
  const best = all.reduce((acc, p) => {
    const d = levenshtein(lower, p.name.toLowerCase())
    return d < acc.dist ? { id: p.id, dist: d } : acc
  }, { id: null as string | null, dist: Infinity })
  return best.dist <= 2 ? best.id : null
}

function buildPrompt(transcript: string, context: Context): string {
  const peopleLines = [
    `- ${context.selfName} / "I" / "me" (id: "${context.selfId}") ← current user`,
    ...context.friends.map(f => `- ${f.name} (id: "${f.id}")`),
  ].join('\n')

  return `Extract expense details from this voice transcript for a bill-splitting app.

Transcript: "${transcript}"

People in context:
${peopleLines}

Return ONLY a JSON object:
{
  "title": string,
  "amount": number,
  "paid_by_id": string | null,
  "participant_ids": string[],
  "split_type": "equal" | "custom",
  "confidence": "high" | "medium" | "low"
}

Rules:
- "I"/"me" maps to id "${context.selfId}"
- Match names case-insensitively, partial match OK ("Ayan" matches "Ayan Kulkarni")
- No participants mentioned -> include all known people split equally
- split_type = "equal" unless per-person amounts are explicitly stated
- confidence = "low" if amount is 0 or unclear; "medium" if names are ambiguous; "high" if title + amount + payer all clear
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
    const { transcript, context } = await req.json()
    if (!transcript || !context?.selfId) {
      return jsonErr(422, 'MISSING_FIELDS', 'transcript and context required')
    }

    // 4. Call Mistral
    const prompt  = buildPrompt(transcript as string, context as Context)
    const result  = await callMistral({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 512,
    }, TIMEOUT_MS) as { choices: { message: { content: string } }[] }

    const raw = JSON.parse(result.choices[0].message.content) as {
      title: string
      amount: number
      paid_by_id: string | null
      participant_ids: string[]
      split_type: string
      confidence: string
    }

    // 5. Safety-net Levenshtein pass — resolve any name strings the model returned as IDs
    const allIds = new Set([context.selfId, ...(context.friends as Person[]).map((f: Person) => f.id)])
    const resolved = {
      ...raw,
      paid_by_id: raw.paid_by_id && !allIds.has(raw.paid_by_id)
        ? resolveName(raw.paid_by_id, context as Context)
        : raw.paid_by_id,
      participant_ids: (raw.participant_ids ?? []).map((id: string) =>
        allIds.has(id) ? id : resolveName(id, context as Context)
      ).filter(Boolean) as string[],
    }

    // 6. Log usage
    sb.from('ai_usage').insert({ profile_id: user.id, request_type: 'quick_add' }).then(() => {})

    const newCount = usageCount + 1
    return json({
      ...resolved,
      _usage: { count: newCount, warn: newCount >= WARN_AT, limit: LIMIT },
    })
  } catch (e) {
    console.error('ai-quick-add error:', e)
    return jsonErr(500, 'INTERNAL_ERROR', "Couldn't understand that. Try again or fill manually.")
  }
})
