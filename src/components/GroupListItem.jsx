import { useNavigate } from 'react-router-dom'

function formatRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function GroupListItem({ group }) {
  const navigate = useNavigate()
  const initials = group.name
    ? group.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <button
      onClick={() => navigate(`/groups/${group.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-left hover:bg-gray-50 active:bg-gray-100"
    >
      <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-indigo-700">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{group.name}</p>
          {group.callerRole === 'admin' && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
              Admin
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          {' · '}
          {formatRelativeTime(group.updated_at)}
        </p>
      </div>
      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
