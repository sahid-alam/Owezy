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

/** variant='incoming' | 'outgoing' */
export default function RequestListItem({ variant, data, onAccept, onReject, onCancel }) {
  const profile = variant === 'incoming' ? data.requester : data.addressee

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
      <Avatar name={profile.name} avatarUrl={profile.avatar_url} />

      <div className="flex-1 min-w-0">
        {variant === 'incoming'
          ? <p className="text-sm text-gray-900">
              <span className="font-medium">{profile.name}</span> wants to add you
            </p>
          : <p className="text-sm font-medium text-gray-900 truncate">{profile.name}</p>
        }
        {variant === 'outgoing' && (
          <p className="text-xs text-gray-400 mt-0.5">Request sent</p>
        )}
      </div>

      {variant === 'incoming' && (
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onAccept(data.friendshipId)}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
          >
            Accept
          </button>
          <button
            onClick={() => onReject(data.friendshipId)}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
          >
            Decline
          </button>
        </div>
      )}

      {variant === 'outgoing' && (
        <button
          onClick={() => onCancel(data.friendshipId)}
          className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
