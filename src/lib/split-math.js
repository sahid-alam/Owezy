/**
 * Pure split math — no React, no Supabase, no side effects.
 * All amounts are in paise (integer) internally; inputs/outputs are rupees (string or number).
 */

function toPaise(rupees) {
  return Math.round(Number(rupees) * 100)
}

function toRupees(paise) {
  return paise / 100
}

/**
 * Compute equal split. Remainder (from integer division) goes to the payer.
 * Returns array of { profile_id, amount } with amounts in rupees (2dp numeric).
 */
export function computeEqualSplit(amountInRupees, participantIds, payerId) {
  const total = toPaise(amountInRupees)
  const n = participantIds.length
  if (n === 0) return []

  const share = Math.floor(total / n)
  const remainder = total - share * n

  return participantIds.map(pid => ({
    profile_id: pid,
    amount: toRupees(pid === payerId ? share + remainder : share),
  }))
}

/**
 * Validate that the sum of custom splits is within ₹0.01 of the total.
 * splits: array of { profile_id, amount } where amount is rupees.
 */
export function validateExactSplits(amountInRupees, splits) {
  if (!splits || splits.length === 0) return false
  const total = toPaise(amountInRupees)
  const sum = splits.reduce((acc, s) => acc + toPaise(s.amount), 0)
  return Math.abs(sum - total) <= 1  // ≤1 paise tolerance
}

/**
 * Recompute equal splits when participants are added.
 * Returns new splits array for all participants (existing + new).
 */
export function recomputeOnParticipantAdded(currentSplits, newParticipantIds, amountInRupees, payerId) {
  const allIds = [
    ...currentSplits.map(s => s.profile_id),
    ...newParticipantIds.filter(id => !currentSplits.some(s => s.profile_id === id)),
  ]
  return computeEqualSplit(amountInRupees, allIds, payerId)
}
