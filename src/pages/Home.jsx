import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth.js'
import { useProfile } from '../hooks/useProfile.js'
import { useMyBalances } from '../hooks/useBalances.js'
import { supabase } from '../lib/supabase.js'
import { formatINR } from '../lib/money.js'
import BottomNav from '../components/BottomNav.jsx'
import AddExpenseSheet from '../components/AddExpenseSheet.jsx'
import FriendBalanceItem from '../components/FriendBalanceItem.jsx'
import PendingConfirmationsList from '../components/PendingConfirmationsList.jsx'
import NotificationBell from '../components/NotificationBell.jsx'
import InstallBanner from '../components/InstallBanner.jsx'

function usePendingForMe(userId) {
  return useQuery({
    queryKey: ['settlements', 'pending-for-me', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('id, amount, note, status, payer_id, payee_id, created_at, paid_at, payer:profiles!payer_id(id, name, avatar_url)')
        .eq('payee_id', userId)
        .eq('status', 'paid')
        .is('deleted_at', null)
        .order('paid_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile } = useProfile()
  const userId = user?.id
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const { balances, isLoading } = useMyBalances()
  const { data: pendingForMe } = usePendingForMe(userId)

  const totalIOwe = useMemo(
    () => balances.filter(b => b.direction === 'i_owe').reduce((s, b) => s + b.netAmount, 0),
    [balances]
  )
  const totalOwedMe = useMemo(
    () => balances.filter(b => b.direction === 'owes_me').reduce((s, b) => s + b.netAmount, 0),
    [balances]
  )

  // Sort: i_owe first (action needed), then owes_me
  const sorted = useMemo(() => [
    ...balances.filter(b => b.direction === 'i_owe'),
    ...balances.filter(b => b.direction === 'owes_me'),
  ], [balances])

  return (
    <div className="flex flex-col min-h-screen bg-white pb-16">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-base font-semibold text-gray-900">
          {profile?.name ? `Hey, ${profile.name.split(' ')[0]}` : 'Owezy'}
        </h1>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg"
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[140px] py-1 z-20">
                <button
                  onClick={() => { setMenuOpen(false); navigate('/profile') }}
                  className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                >
                  Profile
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      <InstallBanner />

      {/* Summary pills */}
      {!isLoading && (totalIOwe > 0 || totalOwedMe > 0) && (
        <div className="flex gap-3 px-4 py-4">
          {totalIOwe > 0 && (
            <div className="flex-1 bg-red-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-red-400 font-medium">You owe</p>
              <p className="text-base font-bold text-red-600">{formatINR(totalIOwe)}</p>
            </div>
          )}
          {totalOwedMe > 0 && (
            <div className="flex-1 bg-green-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-green-500 font-medium">You're owed</p>
              <p className="text-base font-bold text-green-600">{formatINR(totalOwedMe)}</p>
            </div>
          )}
        </div>
      )}

      {/* Pending confirmations */}
      <PendingConfirmationsList settlements={pendingForMe || []} />

      {/* Balance list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 px-6 gap-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-base font-semibold text-gray-700">All settled up</p>
          <p className="text-sm text-gray-400 text-center">No outstanding balances with anyone</p>
        </div>
      ) : (
        <div className="flex-1">
          {sorted.map(b => (
            <FriendBalanceItem key={b.friendId} {...b} />
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-20 right-5 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center z-20 active:scale-95 transition-transform"
        aria-label="Add expense"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {sheetOpen && <AddExpenseSheet onClose={() => setSheetOpen(false)} />}
      <BottomNav />
    </div>
  )
}
