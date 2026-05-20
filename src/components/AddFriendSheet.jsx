import { useState } from 'react'
import { useFriends, useFriendSearch } from '../hooks/useFriends.js'

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

export default function AddFriendSheet({ onClose }) {
  const [query, setQuery] = useState('')
  const { results, isLoading, friendshipMap, isPhone, normalizedPhone } = useFriendSearch(query)
  const { sendRequest, createInvite, acceptRequest } = useFriends()

  function handleSendRequest(addresseeId) {
    sendRequest(addresseeId)
    onClose()
  }

  function handleAccept(friendshipId) {
    acceptRequest(friendshipId)
    onClose()
  }

  function handleInvite() {
    createInvite(normalizedPhone)
    onClose()
  }

  const showInviteCta = query.length > 0 && !isLoading && results.length === 0 && isPhone && normalizedPhone

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] flex flex-col">
        {/* Search bar */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center gap-3">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Name or phone number"
            className="flex-1 text-sm outline-none placeholder-gray-400"
          />
          <button onClick={onClose} className="text-sm text-gray-500 flex-shrink-0">
            Cancel
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {query.length === 0 && (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">
              Search by name or phone
            </p>
          )}

          {query.length > 0 && isLoading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {query.length > 0 && !isLoading && results.length === 0 && !showInviteCta && (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">No one found</p>
          )}

          {showInviteCta && (
            <div className="px-4 py-6 space-y-3">
              <p className="text-sm text-gray-500 text-center">No account found</p>
              <button
                onClick={handleInvite}
                className="w-full py-2.5 border border-indigo-300 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50"
              >
                Invite {normalizedPhone}
              </button>
            </div>
          )}

          <ul>
            {results.map(profile => {
              const rel = friendshipMap[profile.id]
              return (
                <li key={profile.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <Avatar name={profile.name} avatarUrl={profile.avatar_url} />
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                    {profile.name}
                  </span>

                  {!rel && (
                    <button
                      onClick={() => handleSendRequest(profile.id)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 flex-shrink-0"
                    >
                      Send request
                    </button>
                  )}
                  {rel?.status === 'pending' && rel.iAmRequester && (
                    <span className="text-xs text-gray-400 flex-shrink-0">Requested</span>
                  )}
                  {rel?.status === 'pending' && !rel.iAmRequester && (
                    <button
                      onClick={() => handleAccept(rel.friendshipId)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 flex-shrink-0"
                    >
                      Accept
                    </button>
                  )}
                  {rel?.status === 'accepted' && (
                    <span className="text-xs text-gray-400 flex-shrink-0">Friends ✓</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
