import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { getActiveFriendship, unfriend, blockFriend } from '../../lib/friends.js'
import { useAuth } from '../../hooks/useAuth.js'
import { useFriendExpenses } from '../../hooks/useExpenses.js'
import { useBalanceWithFriend } from '../../hooks/useBalances.js'
import { useSettlementsBetween } from '../../hooks/useSettlements.js'
import { computeSourceBreakdown } from '../../lib/balance.js'
import { formatINR } from '../../lib/money.js'
import ExpenseList from '../../components/ExpenseList.jsx'
import SourceBreakdownItem from '../../components/SourceBreakdownItem.jsx'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function FriendDetail() {
  const { friendId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  const { expenses } = useFriendExpenses(friendId)
  const { balance } = useBalanceWithFriend(friendId)
  const { settlements } = useSettlementsBetween(friendId)

  const profileQuery = useQuery({
    queryKey: ['profile', friendId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, upi_id, phone')
        .eq('id', friendId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!friendId,
  })

  const friendshipQuery = useQuery({
    queryKey: ['friendship', userId, friendId],
    queryFn: () => getActiveFriendship(userId, friendId),
    enabled: !!userId && !!friendId,
  })

  function invalidateLists() {
    queryClient.invalidateQueries({ queryKey: ['friends', userId] })
    queryClient.invalidateQueries({ queryKey: ['friendships', 'all-active', userId] })
  }

  const unfriendMutation = useMutation({
    mutationFn: () => unfriend(friendshipQuery.data.id),
    onSuccess: () => {
      invalidateLists()
      navigate('/friends')
    },
    onError: () => toast.error("Couldn't remove friend — try again"),
  })

  const blockMutation = useMutation({
    mutationFn: () => blockFriend(friendshipQuery.data.id),
    onSuccess: () => {
      invalidateLists()
      navigate('/friends')
    },
    onError: () => toast.error("Couldn't block — try again"),
  })

  if (profileQuery.isLoading || friendshipQuery.isLoading) return <Spinner />
  if (!profileQuery.data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Friend not found.</p>
      </div>
    )
  }

  const friend = profileQuery.data
  const friendship = friendshipQuery.data
  const initials = friend.name
    ? friend.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  // Source breakdown
  const breakdown = computeSourceBreakdown(expenses, settlements, userId, friendId)
  const iOwe = balance?.direction === 'i_owe'
  const owesMe = balance?.direction === 'owes_me'
  const hasBalance = balance && balance.netAmount > 0

  // The outstanding debts from the perspective of "what's shown below the balance card"
  const outstandingDebts = iOwe ? breakdown.myDebts : breakdown.theirDebts

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-indigo-600 font-medium"
        >
          ← Back
        </button>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center py-8 px-6 gap-3">
        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
          {friend.avatar_url
            ? <img src={friend.avatar_url} alt={friend.name} className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-indigo-700">{initials}</span>
          }
        </div>
        <h2 className="text-xl font-bold text-gray-900">{friend.name}</h2>
        {friend.upi_id && (
          <p className="text-sm text-gray-400">{friend.upi_id}</p>
        )}
      </div>

      {/* Balance card */}
      <div className="mx-4 mb-4 rounded-2xl border border-gray-100 overflow-hidden">
        {!hasBalance ? (
          <div className="px-4 py-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-gray-500">All settled up</span>
          </div>
        ) : (
          <>
            <div className={`px-4 py-4 ${iOwe ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-sm font-medium ${iOwe ? 'text-red-600' : 'text-green-700'}`}>
                {iOwe
                  ? `You owe ${friend.name} ${formatINR(balance.netAmount)}`
                  : `${friend.name} owes you ${formatINR(balance.netAmount)}`
                }
              </p>
            </div>
            <div className="px-4 py-3 flex gap-2">
              {iOwe ? (
                <button
                  onClick={() => navigate(`/settle/${friendId}`)}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
                >
                  Settle up
                </button>
              ) : (
                <button
                  disabled
                  className="flex-1 py-2 border border-gray-200 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
                  title="Reminders coming soon"
                >
                  Remind
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Source breakdown (only when there's an outstanding balance) */}
      {hasBalance && outstandingDebts.length > 0 && (
        <div className="border-t border-gray-100">
          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Breakdown
          </p>
          {outstandingDebts.map(d => (
            <SourceBreakdownItem
              key={d.expenseId}
              expenseId={d.expenseId}
              title={d.title}
              amount={d.amount}
              date={d.date}
            />
          ))}
        </div>
      )}

      {/* Expenses */}
      <div className="border-t border-gray-100 mt-4">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Expenses</p>
          <button
            onClick={() => navigate(`/expenses/new?friendId=${friendId}`)}
            className="text-sm text-indigo-600 font-medium"
          >
            + Add
          </button>
        </div>
        <ExpenseList
          expenses={expenses}
          myId={userId}
          onAdd={() => navigate(`/expenses/new?friendId=${friendId}`)}
          emptyMessage="No expenses yet — add one to start splitting"
        />
      </div>

      {/* Actions — only shown when an active friendship exists */}
      {friendship && friendship.status === 'accepted' && (
        <div className="mt-6 border-t border-gray-100">
          <button
            disabled={unfriendMutation.isPending}
            onClick={() => unfriendMutation.mutate()}
            className="w-full px-4 py-4 text-sm text-red-500 text-left hover:bg-red-50 disabled:opacity-50"
          >
            {unfriendMutation.isPending ? 'Removing…' : 'Remove friend'}
          </button>
          <div className="border-t border-gray-100" />
          <button
            disabled={blockMutation.isPending}
            onClick={() => blockMutation.mutate()}
            className="w-full px-4 py-4 text-sm text-red-500 text-left hover:bg-red-50 disabled:opacity-50"
          >
            {blockMutation.isPending ? 'Blocking…' : 'Block'}
          </button>
        </div>
      )}
    </div>
  )
}
