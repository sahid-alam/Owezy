import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  // Caller must present the service-role key as Bearer token.
  // Set this in cron-job.org's request header: Authorization: Bearer <service_role_key>
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date()

  // get_reminder_candidates queries raw tables (no auth.uid() filter),
  // returning all outstanding debts the service role can see.
  const { data: candidates, error: candidatesErr } = await supabase.rpc(
    'get_reminder_candidates'
  )
  if (candidatesErr) {
    console.error('get_reminder_candidates failed:', candidatesErr.message)
    return new Response(JSON.stringify({ error: candidatesErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let processed = 0
  let skipped = 0

  for (const row of (candidates ?? []) as ReminderCandidate[]) {
    const reminderCount = row.reminder_count_in_cycle ?? 0

    // Cap: two reminders per debt cycle (day 3 and day 7)
    if (reminderCount >= 2) {
      skipped++
      continue
    }

    const oldestAt = row.oldest_expense_at ? new Date(row.oldest_expense_at) : null
    if (!oldestAt) {
      skipped++
      continue
    }

    const ageDays = (now.getTime() - oldestAt.getTime()) / 86_400_000
    const lastRemindedAt = row.last_reminded_at ? new Date(row.last_reminded_at) : null
    const daysSinceRemind = lastRemindedAt
      ? (now.getTime() - lastRemindedAt.getTime()) / 86_400_000
      : Infinity

    const isFirstEligible  = reminderCount === 0 && ageDays >= 3
    const isSecondEligible = reminderCount === 1 && ageDays >= 7 && daysSinceRemind >= 4

    if (!isFirstEligible && !isSecondEligible) {
      skipped++
      continue
    }

    const { error: notifErr } = await supabase.rpc('insert_notification', {
      p_recipient_id: row.debtor_id,
      p_type: 'reminder',
      p_data: {
        amount:        row.net_amount,
        creditor_id:   row.creditor_id,
        creditor_name: row.creditor_name,
        context:       row.oldest_expense_title ?? 'recent expenses',
      },
    })

    if (notifErr) {
      console.error(
        `insert_notification failed for ${row.debtor_id}:`,
        notifErr.message
      )
      skipped++
      continue
    }

    const { error: updateErr } = await supabase
      .from('friendships')
      .update({
        last_reminded_at:        now.toISOString(),
        reminder_count_in_cycle: reminderCount + 1,
      })
      .eq('id', row.friendship_id)

    if (updateErr) {
      console.error(
        `friendship update failed for ${row.friendship_id}:`,
        updateErr.message
      )
    }

    console.log(
      `Reminded ${row.debtor_id} → ${row.creditor_id}` +
      ` ₹${row.net_amount} (cycle ${reminderCount + 1}/2)`
    )
    processed++
  }

  return new Response(JSON.stringify({ processed, skipped }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

interface ReminderCandidate {
  friendship_id:           string
  debtor_id:               string
  creditor_id:             string
  creditor_name:           string
  net_amount:              number
  oldest_expense_at:       string | null
  oldest_expense_title:    string | null
  last_reminded_at:        string | null
  reminder_count_in_cycle: number
}
