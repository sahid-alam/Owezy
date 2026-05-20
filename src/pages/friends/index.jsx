import { useState } from 'react'
import { useFriends } from '../../hooks/useFriends.js'
import FriendListItem from '../../components/FriendListItem.jsx'
import RequestListItem from '../../components/RequestListItem.jsx'
import AddFriendSheet from '../../components/AddFriendSheet.jsx'

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

const TABS = ['friends', 'requests', 'invites']

export default function FriendsIndex() {
  const [tab, setTab] = useState('friends')
  const [sheetOpen, setSheetOpen] = useState(false)

  const {
    friends, incoming, outgoing, invites,
    isLoading, incomingCount,
    acceptRequest, rejectRequest, cancelRequest, cancelInvite,
  } = useFriends()

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg font-bold text-gray-900">Friends</h1>
        <button
          onClick={() => setSheetOpen(true)}
          className="text-sm font-medium text-indigo-600"
        >
          + Add
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 sticky top-[52px] bg-white z-10">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500'
            }`}
          >
            {t === 'friends' ? 'Friends' : t === 'requests' ? 'Requests' : 'Invites'}
            {t === 'requests' && incomingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center bg-indigo-600 text-white text-xs rounded-full w-4 h-4">
                {incomingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1">

        {/* Friends tab */}
        {tab === 'friends' && (
          isLoading
            ? <Spinner />
            : friends.length === 0
              ? <EmptyState message="No friends yet — add someone to start splitting" />
              : <ul>
                  {friends.map(({ friendshipId, friend }) => (
                    <li key={friendshipId}>
                      <FriendListItem friend={friend} friendshipId={friendshipId} />
                    </li>
                  ))}
                </ul>
        )}

        {/* Requests tab */}
        {tab === 'requests' && (
          incoming.length === 0 && outgoing.length === 0
            ? <EmptyState message="No pending requests" />
            : <>
                {incoming.length > 0 && (
                  <section>
                    <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      From others
                    </p>
                    <ul>
                      {incoming.map(r => (
                        <li key={r.friendshipId}>
                          <RequestListItem
                            variant="incoming"
                            data={r}
                            onAccept={acceptRequest}
                            onReject={rejectRequest}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {outgoing.length > 0 && (
                  <section>
                    <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Sent by you
                    </p>
                    <ul>
                      {outgoing.map(r => (
                        <li key={r.friendshipId}>
                          <RequestListItem
                            variant="outgoing"
                            data={r}
                            onCancel={cancelRequest}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
        )}

        {/* Invites tab */}
        {tab === 'invites' && (
          invites.length === 0
            ? <EmptyState message="No invites sent yet" />
            : <ul>
                {invites.map(inv => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-gray-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{inv.phone}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Pending invite</p>
                    </div>
                    <button
                      onClick={() => cancelInvite(inv.id)}
                      className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
        )}
      </div>

      {sheetOpen && <AddFriendSheet onClose={() => setSheetOpen(false)} />}
    </div>
  )
}
