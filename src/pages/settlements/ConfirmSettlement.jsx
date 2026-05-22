import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useSettlement, useConfirmSettlement, useDisputeSettlement } from '../../hooks/useSettlements.js'
import { useFriendExpenses } from '../../hooks/useExpenses.js'
import { computeSourceBreakdown } from '../../lib/balance.js'
import { formatINR } from '../../lib/money.js'
import SourceBreakdownItem from '../../components/SourceBreakdownItem.jsx'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function ConfirmSettlement() {
  const { settlementId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id

  const { settlement, isLoading } = useSettlement(settlementId)
  const payerId = settlement?.payer_id

  // Load expenses between the pair for FIFO breakdown preview
  const { expenses } = useFriendExpenses(payerId)

  const confirm = useConfirmSettlement(payerId)
  const dispute = useDisputeSettlement(payerId)

  if (isLoading) return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
      </div>
      <Spinner />
    </div>
  )

  if (!settlement) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Settlement not found.</p>
      </div>
    )
  }

  // Guard: this confirmation is only for the payee
  if (settlement.payee_id !== userId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <p className="text-sm text-gray-400 text-center">This confirmation isn't for you.</p>
      </div>
    )
  }

  // Guard: nothing to confirm if not in 'paid' state
  if (settlement.status !== 'paid') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <p className="text-sm text-gray-400 text-center">Nothing to confirm here.</p>
      </div>
    )
  }

  const payer = settlement.payer
  const paidDate = new Date(settlement.paid_at || settlement.created_at)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  // Compute FIFO source breakdown for preview
  // We don't have confirmed settlements here (they affect balance already)
  // Use empty confirmed settlements — the current outstanding debts are what this payment clears
  const breakdown = computeSourceBreakdown(expenses, [], userId, payerId)
  const settleAmount = Number(settlement.amount)
  let remaining = settleAmount
  const willClear = []
  for (const d of breakdown.myDebts) {
    if (remaining <= 0) break
    const clears = Math.min(remaining, d.amount)
    willClear.push({ ...d, amount: clears })
    remaining -= clears
  }
  const credit = remaining > 0 ? remaining : 0

  async function handleConfirm() {
    try {
      await confirm.mutateAsync(settlementId)
      navigate(`/friends/${payerId}`)
    } catch {
      // toast handled by hook
    }
  }

  async function handleDispute() {
    try {
      await dispute.mutateAsync(settlementId)
      navigate(`/friends/${payerId}`)
    } catch {
      // toast handled by hook
    }
  }

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
      </div>

      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900">
          {payer?.name} says they paid you
        </h1>
        <p className="text-3xl font-bold text-green-600 mt-2">{formatINR(settleAmount)}</p>
        <p className="text-sm text-gray-400 mt-1">{paidDate}</p>
        {settlement.note && (
          <p className="text-sm text-gray-600 mt-2 italic">"{settlement.note}"</p>
        )}
      </div>

      {/* What this clears */}
      {willClear.length > 0 && (
        <div className="border-t border-gray-100 mt-2">
          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            This clears
          </p>
          {willClear.map(d => (
            <SourceBreakdownItem
              key={d.expenseId}
              expenseId={d.expenseId}
              title={d.title}
              amount={d.amount}
              date={d.date}
            />
          ))}
          {credit > 0 && (
            <p className="px-4 py-3 text-sm text-green-600 font-medium">
              Clears all outstanding balance — {payer?.name} would owe you {formatINR(credit)}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pt-6 space-y-3">
        <button
          disabled={confirm.isPending || dispute.isPending}
          onClick={handleConfirm}
          className="w-full py-3.5 bg-green-600 text-white rounded-xl font-semibold text-base disabled:opacity-40"
        >
          {confirm.isPending ? 'Confirming…' : 'Yes, received'}
        </button>
        <button
          disabled={confirm.isPending || dispute.isPending}
          onClick={handleDispute}
          className="w-full py-3.5 border border-gray-200 text-red-500 rounded-xl font-medium text-sm disabled:opacity-40"
        >
          {dispute.isPending ? 'Processing…' : "No, didn't receive"}
        </button>
      </div>
    </div>
  )
}
