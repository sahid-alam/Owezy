import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../hooks/useAuth.js'
import { useBalanceWithFriend } from '../../hooks/useBalances.js'
import { useInitiateAndPay } from '../../hooks/useSettlements.js'
import { buildUpiLink } from '../../lib/upi.js'
import { formatINR } from '../../lib/money.js'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function SettleUp() {
  const { friendId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id

  const { balance, isLoading: balanceLoading } = useBalanceWithFriend(friendId)

  const friendQuery = useQuery({
    queryKey: ['profile', friendId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, upi_id, avatar_url')
        .eq('id', friendId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!friendId,
  })

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('Settle up')

  // Default to full outstanding balance once loaded
  useEffect(() => {
    if (balance && balance.netAmount > 0 && balance.direction === 'i_owe' && !amount) {
      setAmount(balance.netAmount.toFixed(2))
    }
  }, [balance])

  const initiateAndPay = useInitiateAndPay()

  if (balanceLoading || friendQuery.isLoading) return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
      </div>
      <Spinner />
    </div>
  )

  const friend = friendQuery.data
  const hasUpi = !!friend?.upi_id

  const parsedAmount = parseFloat(amount)
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= 1

  function handleUpiPay() {
    if (!isValidAmount || !hasUpi) return
    try {
      const link = buildUpiLink({
        payeeUpiId: friend.upi_id,
        payeeName: friend.name,
        amount: parsedAmount,
        note: note || 'Settle up',
      })
      window.location.href = link
    } catch {
      // buildUpiLink throws if upi_id missing — shouldn't reach here given guard
    }
  }

  async function handleMarkPaid() {
    if (!isValidAmount) return
    await initiateAndPay.mutateAsync({
      payeeId: friendId,
      amount: parsedAmount,
      note: note || null,
    })
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
      </div>

      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Pay {friend?.name}</h1>
        {balance && balance.direction === 'i_owe' && balance.netAmount > 0 && (
          <p className="text-sm text-red-500 mt-1">You owe {formatINR(balance.netAmount)}</p>
        )}
      </div>

      {/* Amount */}
      <div className="px-4 py-4 border-t border-gray-100">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Amount</label>
        <div className="flex items-center gap-2">
          <span className="text-3xl text-gray-400 font-light">₹</span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 text-3xl font-bold text-gray-900 placeholder-gray-300 outline-none border-b-2 border-indigo-500 pb-1 bg-transparent"
          />
        </div>
        {amount && !isValidAmount && (
          <p className="text-xs text-red-500 mt-1">Amount must be at least ₹1</p>
        )}
      </div>

      {/* Note */}
      <div className="px-4 py-4 border-t border-gray-100">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Note</label>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What's this for?"
          className="w-full text-sm text-gray-700 outline-none border-b border-gray-200 pb-2 focus:border-indigo-400 bg-transparent"
        />
      </div>

      {/* UPI info */}
      {hasUpi ? (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">UPI: <span className="text-gray-700 font-medium">{friend.upi_id}</span></p>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">{friend?.name} hasn't added a UPI ID yet</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pt-4 pb-8 space-y-3">
        {hasUpi && (
          <button
            disabled={!isValidAmount}
            onClick={handleUpiPay}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold text-base disabled:opacity-40"
          >
            Open UPI app
          </button>
        )}

        <button
          disabled={!isValidAmount || initiateAndPay.isPending}
          onClick={handleMarkPaid}
          className="w-full py-3.5 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm disabled:opacity-40"
        >
          {initiateAndPay.isPending
            ? 'Recording…'
            : hasUpi ? "I've paid this" : "I've paid manually"
          }
        </button>
      </div>
    </div>
  )
}
