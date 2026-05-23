import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deletes receipt objects from storage older than 30 days.
// The "Receipt no longer available" placeholder in the UI handles expired receipts gracefully.
//
// Cron-job.org setup (same pattern as daily-reminders):
//   URL: https://<project-ref>.supabase.co/functions/v1/cleanup-receipts
//   Method: POST
//   Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//   Schedule: daily (e.g. 03:00 UTC)

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RETENTION_DAYS    = parseInt(Deno.env.get('RECEIPT_RETENTION_DAYS') ?? '30')
const BATCH_SIZE        = 100

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let deleted = 0
  let offset  = 0

  try {
    while (true) {
      // Query storage.objects directly — service role bypasses RLS
      const { data: objects, error } = await serviceClient
        .schema('storage')
        .from('objects')
        .select('name')
        .eq('bucket_id', 'receipts')
        .lt('created_at', cutoff)
        .range(offset, offset + BATCH_SIZE - 1)

      if (error) {
        console.error('cleanup-receipts list error:', error.message)
        break
      }
      if (!objects || objects.length === 0) break

      const paths = objects.map((o: { name: string }) => o.name)
      const { error: removeErr } = await serviceClient.storage.from('receipts').remove(paths)
      if (removeErr) {
        console.error('cleanup-receipts remove error:', removeErr.message)
      } else {
        deleted += paths.length
      }

      if (objects.length < BATCH_SIZE) break
      offset += BATCH_SIZE
    }

    console.log(`cleanup-receipts: deleted ${deleted} objects older than ${RETENTION_DAYS} days`)
    return new Response(JSON.stringify({ deleted }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('cleanup-receipts error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
