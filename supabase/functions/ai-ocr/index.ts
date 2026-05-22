import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MISTRAL_KEY       = Deno.env.get('MISTRAL_API_KEY')!
const LIMIT             = parseInt(Deno.env.get('AI_DAILY_LIMIT') ?? '20')
const WARN_AT           = parseInt(Deno.env.get('AI_DAILY_WARN_AT') ?? '16')
const TIMEOUT_MS        = 25_000

const OCR_PROMPT = `You are extracting line items from a receipt photo. Return ONLY a JSON object with this exact structure, no explanation:
{
  "items": [{ "name": string, "price": number, "quantity": number }],
  "total": number,
  "tax_amount": number,
  "currency": "INR",
  "confidence": "high" | "medium" | "low"
}

Rules:
- Merge all tax rows (GST, SGST, CGST, VAT, service charge, packaging charge) into a single tax_amount
- Do NOT include tax/charge rows as individual items
- Lines like "Round Off", "Rounding", or similar adjustment rows: exclude from items, add the value (sign-preserving) to tax_amount
- quantity defaults to 1 if not printed on receipt
- Omit lines with no clear numeric price
- If the receipt is a food delivery app screenshot (Swiggy/Zomato/Zepto): extract individual food items listed above the "Item Total" field; delivery fee, platform fee, and packaging charges all go into tax_amount
- confidence = "high" if text is clearly legible, "medium" if some items unclear, "low" if blurry/unreadable
- If no items can be read: { "items": [], "total": 0, "tax_amount": 0, "currency": "INR", "confidence": "low" }
- Return ONLY the JSON object`

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function jsonErr(status: number, code: string, message?: string) {
  return json({ error: code, message: message ?? code }, status)
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
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

    // 2. Rate limit (server-side — never trusted from client)
    const { data: count } = await sb.rpc('get_my_ai_usage_count')
    const usageCount = (count as number) ?? 0
    if (usageCount >= LIMIT) {
      return jsonErr(429, 'DAILY_LIMIT_REACHED', 'Daily AI limit reached. Try again tomorrow or use manual entry.')
    }

    // 3. Parse body
    const { storagePath } = await req.json()
    if (!storagePath || typeof storagePath !== 'string') {
      return jsonErr(422, 'MISSING_STORAGE_PATH', 'storagePath required')
    }

    // 4. Generate signed URL server-side (service role — no client exposure)
    const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: signedData, error: signedErr } = await serviceClient.storage
      .from('receipts')
      .createSignedUrl(storagePath, 60)
    if (signedErr || !signedData?.signedUrl) {
      return jsonErr(422, 'STORAGE_ERROR', "Couldn't access receipt image")
    }

    // 5. Fetch image and base64-encode
    const imgRes = await fetch(signedData.signedUrl, { signal: AbortSignal.timeout(10_000) })
    if (!imgRes.ok) return jsonErr(422, 'IMAGE_FETCH_FAILED', "Couldn't retrieve receipt image")
    const buf  = await imgRes.arrayBuffer()
    const b64  = uint8ToBase64(new Uint8Array(buf))
    const mime = imgRes.headers.get('content-type') ?? 'image/jpeg'

    // 6. Call Mistral pixtral-12b-2409
    const result = await callMistral({
      model: 'pixtral-12b-2409',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          { type: 'text', text: OCR_PROMPT },
        ],
      }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    }, TIMEOUT_MS) as { choices: { message: { content: string } }[] }

    const parsed = JSON.parse(result.choices[0].message.content)

    // 7. Log usage (non-blocking — failure doesn't block the response)
    sb.from('ai_usage').insert({ profile_id: user.id, request_type: 'ocr' }).then(() => {})

    // 8. Attach usage metadata so client can show warning
    const newCount = usageCount + 1
    return json({
      ...parsed,
      _usage: { count: newCount, warn: newCount >= WARN_AT, limit: LIMIT },
    })
  } catch (e) {
    console.error('ai-ocr error:', e)
    return jsonErr(500, 'INTERNAL_ERROR', "Couldn't read receipt. Try a clearer photo or enter manually.")
  }
})
