import { useNavigate } from 'react-router-dom'

function formatDateRange(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00')
  const end   = new Date(endDate   + 'T00:00:00')
  const opts  = { day: 'numeric', month: 'short' }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.toLocaleDateString('en-IN', opts)}`
  }
  return `${start.toLocaleDateString('en-IN', opts)} – ${end.toLocaleDateString('en-IN', opts)}`
}

function isUpcoming(startDate) {
  return new Date(startDate + 'T00:00:00') > new Date()
}

function isOngoing(startDate, endDate) {
  const now   = new Date()
  const start = new Date(startDate + 'T00:00:00')
  const end   = new Date(endDate   + 'T00:00:00')
  return start <= now && now <= end
}

export default function TripListItem({ id, name, destination, startDate, endDate, memberCount, callerRole }) {
  const navigate = useNavigate()

  const upcoming = isUpcoming(startDate)
  const ongoing  = isOngoing(startDate, endDate)
  const statusLabel = upcoming ? 'Upcoming' : ongoing ? 'Ongoing' : 'Ended'
  const statusColor = upcoming ? 'bg-blue-100 text-blue-700' : ongoing ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'

  return (
    <button
      onClick={() => navigate(`/trips/${id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-left hover:bg-gray-50 active:bg-gray-100"
    >
      <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xl">
        ✈️
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          {callerRole === 'admin' && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
              Admin
            </span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {destination && `${destination} · `}
          {formatDateRange(startDate, endDate)}
          {' · '}
          {memberCount} {memberCount === 1 ? 'person' : 'people'}
        </p>
      </div>
      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
