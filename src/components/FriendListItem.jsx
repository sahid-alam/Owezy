import { useNavigate } from 'react-router-dom'

function Avatar({ name, avatarUrl }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        : <span className="text-sm font-medium text-indigo-700">{initials}</span>
      }
    </div>
  )
}

export default function FriendListItem({ friend, friendshipId }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(`/friends/${friend.id}`, { state: { friendshipId } })}
      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50"
    >
      <Avatar name={friend.name} avatarUrl={friend.avatar_url} />
      <span className="flex-1 text-sm font-medium text-gray-900">{friend.name}</span>
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
