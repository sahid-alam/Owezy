import { useFriends } from '../../hooks/useFriends.js'

function Avatar({ name, avatarUrl }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        : <span className="text-sm font-medium text-indigo-700">{initials}</span>
      }
    </div>
  )
}

export default function AddGroupMember({ currentMemberProfileIds, onAdd, onClose, isPending }) {
  const { friends, isLoading } = useFriends()

  const eligible = friends.filter(({ friend }) => !currentMemberProfileIds.includes(friend.id))

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Add someone</h3>
          <button onClick={onClose} className="text-sm text-gray-500">Cancel</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : eligible.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">
              {friends.length === 0
                ? 'Add friends first to invite them to groups'
                : 'All your friends are already in this group'}
            </p>
          ) : (
            <ul>
              {eligible.map(({ friend }) => (
                <li key={friend.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <Avatar name={friend.name} avatarUrl={friend.avatar_url} />
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{friend.name}</span>
                  <button
                    disabled={isPending}
                    onClick={() => onAdd(friend.id)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
