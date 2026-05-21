import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyTrips } from '../../hooks/useTrips.js'
import TripListItem from '../../components/TripListItem.jsx'
import BottomNav from '../../components/BottomNav.jsx'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex items-center justify-center py-16 px-6">
      <p className="text-sm text-gray-400 text-center">{message}</p>
    </div>
  )
}

export default function TripsIndex() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('active')

  const { trips: activeTrips,   isLoading: activeLoading   } = useMyTrips(false)
  const { trips: archivedTrips, isLoading: archivedLoading } = useMyTrips(true)

  const isActive = tab === 'active'
  const trips     = isActive ? activeTrips   : archivedTrips
  const isLoading = isActive ? activeLoading : archivedLoading

  return (
    <div className="flex flex-col min-h-screen bg-white pb-16">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg font-bold text-gray-900">Trips</h1>
        <button
          onClick={() => navigate('/trips/new')}
          className="text-sm font-medium text-indigo-600"
        >
          + New
        </button>
      </div>

      <div className="flex border-b border-gray-100 sticky top-[52px] bg-white z-10">
        {['active', 'archived'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500'
            }`}
          >
            {t === 'active' ? 'Active' : 'Archived'}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {isLoading ? (
          <Spinner />
        ) : trips.length === 0 ? (
          <EmptyState
            message={
              isActive
                ? 'No trips yet — plan your first one ✈️'
                : 'No archived trips'
            }
          />
        ) : (
          <ul>
            {trips.map(t => (
              <li key={t.id}>
                <TripListItem
                  id={t.id}
                  name={t.name}
                  destination={t.destination}
                  startDate={t.start_date}
                  endDate={t.end_date}
                  memberCount={t.memberCount}
                  callerRole={t.callerRole}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
