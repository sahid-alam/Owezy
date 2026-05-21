import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useTrip, useTripMembers, useTripExpenses, useTripBalances } from '../../hooks/useTrips.js'
import { useFriends } from '../../hooks/useFriends.js'
import Avatar from '../../components/Avatar.jsx'
import TripExpensesByDay from '../../components/TripExpensesByDay.jsx'
import { formatINR } from '../../lib/money.js'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function formatDateRange(s, e) {
  const start = new Date(s + 'T00:00:00')
  const end   = new Date(e + 'T00:00:00')
  const opts  = { day: 'numeric', month: 'short' }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.toLocaleDateString('en-IN', opts)} ${end.getFullYear()}`
  }
  return `${start.toLocaleDateString('en-IN', opts)} – ${end.toLocaleDateString('en-IN', opts)} ${end.getFullYear()}`
}

function BudgetBar({ spent, total }) {
  const pct = Math.min(100, Math.round((spent / total) * 100))
  const over = spent > total
  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>{formatINR(spent)} spent</span>
        <span className={over ? 'text-red-500 font-semibold' : ''}>{formatINR(total)} budget</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && (
        <p className="text-xs text-red-500 mt-1">{formatINR(spent - total)} over budget</p>
      )}
    </div>
  )
}

function MembersTab({ tripId, isAdmin, userId }) {
  const { members, addMember, removeMember, setMemberRole, leaveTrip } = useTripMembers(tripId)
  const { friends } = useFriends()
  const [showAddFriend, setShowAddFriend] = useState(false)
  const memberIds = new Set(members.map(m => m.profile_id))
  const eligible = friends.filter(f => !memberIds.has(f.friend.id))

  return (
    <div>
      {isAdmin && (
        <div className="px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => setShowAddFriend(v => !v)}
            className="text-sm text-indigo-600 font-medium"
          >
            + Add member
          </button>
          {showAddFriend && eligible.length > 0 && (
            <ul className="mt-2 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {eligible.map(f => (
                <li key={f.friend.id}>
                  <button
                    onClick={async () => {
                      await addMember.mutateAsync(f.friend.id)
                      setShowAddFriend(false)
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
                  >
                    {f.friend.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showAddFriend && eligible.length === 0 && (
            <p className="mt-2 text-xs text-gray-400">All friends are already in this trip</p>
          )}
        </div>
      )}

      <ul>
        {members.map(m => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
            <Avatar userId={m.profile_id} name={m.profile?.name} avatarUrl={m.profile?.avatar_url} size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{m.profile?.name}</p>
                {m.role === 'admin' && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Admin</span>
                )}
                {m.profile_id === userId && (
                  <span className="text-xs text-gray-400">(you)</span>
                )}
              </div>
            </div>
            {isAdmin && m.profile_id !== userId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMemberRole.mutateAsync({ profileId: m.profile_id, role: m.role === 'admin' ? 'member' : 'admin' })}
                  className="text-xs text-indigo-600 font-medium px-2 py-1 border border-indigo-200 rounded-lg"
                >
                  {m.role === 'admin' ? 'Demote' : 'Make admin'}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove ${m.profile?.name} from trip?`)) {
                      removeMember.mutate(m.profile_id)
                    }
                  }}
                  className="text-xs text-red-500 font-medium px-2 py-1 border border-red-200 rounded-lg"
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="px-4 py-4">
        <button
          onClick={() => {
            if (window.confirm('Leave this trip?')) leaveTrip.mutate()
          }}
          className="text-sm text-red-500 font-medium"
        >
          Leave trip
        </button>
      </div>
    </div>
  )
}

function BalancesTab({ tripId, userId }) {
  const navigate = useNavigate()
  const { balances, isLoading } = useTripBalances(tripId)

  if (isLoading) return <Spinner />

  const myBalances = balances.filter(b => b.user_a === userId || b.user_b === userId)

  if (myBalances.length === 0) return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm text-gray-400">All settled up 🎉</p>
    </div>
  )

  return (
    <ul>
      {myBalances.map((b, i) => {
        const iOwe   = (b.direction === 'b_owes_a' && b.user_b === userId) ||
                       (b.direction === 'a_owes_b' && b.user_a === userId)
        const otherId = b.user_a === userId ? b.user_b : b.user_a

        return (
          <li key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <div>
              <p className="text-sm text-gray-700">
                {iOwe ? `You owe` : `Owed by you`}
              </p>
              <p className={`text-base font-semibold ${iOwe ? 'text-red-600' : 'text-green-600'}`}>
                {formatINR(b.net_amount)}
              </p>
            </div>
            {iOwe && (
              <button
                onClick={() => navigate(`/settle/${otherId}?tripId=${tripId}`)}
                className="text-sm font-medium text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg"
              >
                Settle up
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default function TripDetail() {
  const { tripId } = useParams()
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const userId     = user?.id
  const [tab, setTab]         = useState('expenses')
  const [showMenu, setShowMenu] = useState(false)

  const { trip, isLoading: tripLoading, archiveTrip } = useTrip(tripId)
  const { isAdmin } = useTripMembers(tripId)
  const { expenses, isLoading: expLoading } = useTripExpenses(tripId)

  if (tripLoading) return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
      </div>
      <Spinner />
    </div>
  )

  if (!trip) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-sm text-gray-400">Trip not found</p>
    </div>
  )

  const today    = new Date().toISOString().split('T')[0]
  const isEnded  = trip.end_date < today
  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="flex flex-col min-h-screen bg-white pb-4">
      {/* Nav */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
        <div className="flex items-center gap-3">
          {isEnded && (
            <Link
              to={`/trips/${tripId}/recap`}
              className="text-sm font-medium text-indigo-600 border border-indigo-200 px-2.5 py-1 rounded-lg"
            >
              Share Recap
            </Link>
          )}
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="text-gray-500 p-1"
            >
              ···
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 min-w-[160px]">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => { navigate(`/trips/${tripId}/edit`); setShowMenu(false) }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Edit trip
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Archive this trip?')) {
                          archiveTrip.mutate()
                          navigate('/trips')
                        }
                        setShowMenu(false)
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Archive
                    </button>
                  </>
                )}
                <button
                  onClick={() => navigate(`/expenses/new?tripId=${tripId}`)}
                  className="w-full px-4 py-2.5 text-left text-sm text-indigo-600 font-medium hover:bg-gray-50"
                >
                  + Add expense
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-gray-900">{trip.name}</h1>
        {trip.destination && (
          <p className="text-sm text-gray-500 mt-0.5">{trip.destination}</p>
        )}
        <p className="text-sm text-gray-400 mt-0.5">
          {formatDateRange(trip.start_date, trip.end_date)}
          {isEnded ? ' · Ended' : ''}
        </p>
      </div>

      {/* Budget bar */}
      {trip.budget && (
        <BudgetBar spent={totalSpent} total={Number(trip.budget)} />
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100 sticky bg-white z-10" style={{ top: '52px' }}>
        {['expenses', 'balances', 'members'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1">
        {tab === 'expenses' && (
          expLoading ? <Spinner /> : expenses.length === 0 ? (
            <div className="px-4 py-12 text-center space-y-3">
              <p className="text-sm text-gray-400">No expenses yet</p>
              <button
                onClick={() => navigate(`/expenses/new?tripId=${tripId}`)}
                className="text-sm text-indigo-600 font-medium"
              >
                + Add first expense
              </button>
            </div>
          ) : (
            <TripExpensesByDay trip={trip} expenses={expenses} />
          )
        )}
        {tab === 'balances' && <BalancesTab tripId={tripId} userId={userId} />}
        {tab === 'members' && <MembersTab tripId={tripId} isAdmin={isAdmin} userId={userId} />}
      </div>
    </div>
  )
}
