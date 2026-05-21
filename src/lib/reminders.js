/**
 * Reminder message helpers. Pure functions — no DOM, no Supabase.
 * Copy lives here so it's easy to localise (Phase 2 Hindi support).
 */

/**
 * @param {{ amount: number|string, contextName?: string, payerName: string }} opts
 * @returns {string}
 */
export function buildReminderMessage({ amount, contextName, payerName }) {
  const ctx = contextName || 'your recent expenses'
  return `Hey ${payerName}, just a reminder you still owe me ₹${amount} from ${ctx} 🙂`
}

/**
 * @param {{ friendPhone?: string|null }} opts
 * @returns {'whatsapp'|'clipboard'}
 */
export function getReminderTarget({ friendPhone }) {
  return friendPhone && friendPhone.trim() ? 'whatsapp' : 'clipboard'
}
