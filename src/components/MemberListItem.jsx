import { useState } from 'react'

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

export default function MemberListItem({ member, isCallerAdmin, isCurrentUser, onRemove, onPromote, onDemote }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = member.role === 'admin'
  const name = member.profile?.name || 'Unknown'

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
      <Avatar name={name} avatarUrl={member.profile?.avatar_url} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          {isCurrentUser && (
            <span className="text-xs text-gray-400 flex-shrink-0">You</span>
          )}
        </div>
        {isAdmin && (
          <p className="text-xs text-indigo-600 font-medium">Admin</p>
        )}
      </div>

      {isCallerAdmin && !isCurrentUser && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[160px] py-1 z-20">
                {!isAdmin && (
                  <button
                    onClick={() => { setMenuOpen(false); onPromote(member.profile_id) }}
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                  >
                    Make admin
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => { setMenuOpen(false); onDemote(member.profile_id) }}
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                  >
                    Remove admin
                  </button>
                )}
                {!isAdmin && (
                  <button
                    onClick={() => { setMenuOpen(false); onRemove(member.profile_id, name) }}
                    className="w-full px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
