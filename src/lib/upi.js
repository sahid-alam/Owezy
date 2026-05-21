/**
 * Pure UPI deep-link builder. No DOM, no fetch, no side effects.
 * Component is responsible for window.location.href assignment.
 */
export function buildUpiLink({ payeeUpiId, payeeName, amount, note }) {
  if (!payeeUpiId || !payeeUpiId.trim()) {
    throw new Error('payeeUpiId is required')
  }

  const params = new URLSearchParams({
    pa: payeeUpiId.trim(),
    pn: payeeName || '',
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tn: note || 'Settle up',
  })

  return `upi://pay?${params.toString()}`
}
