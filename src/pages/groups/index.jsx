import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyGroups } from '../../hooks/useGroups.js'
import GroupListItem from '../../components/GroupListItem.jsx'
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

export default function GroupsIndex() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('active')

  const { groups: activeGroups, isLoading: activeLoading } = useMyGroups(false)
  const { groups: archivedGroups, isLoading: archivedLoading } = useMyGroups(true)

  const isActive = tab === 'active'
  const groups = isActive ? activeGroups : archivedGroups
  const isLoading = isActive ? activeLoading : archivedLoading

  return (
    <div className="flex flex-col min-h-screen bg-white pb-16">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg font-bold text-gray-900">Groups</h1>
        <button
          onClick={() => navigate('/groups/new')}
          className="text-sm font-medium text-indigo-600"
        >
          + New
        </button>
      </div>

      {/* Tabs */}
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

      {/* Content */}
      <div className="flex-1">
        {isLoading ? (
          <Spinner />
        ) : groups.length === 0 ? (
          <EmptyState
            message={
              isActive
                ? 'No groups yet — create one or ask a friend to add you'
                : 'No archived groups'
            }
          />
        ) : (
          <ul>
            {groups.map(g => (
              <li key={g.id}>
                <GroupListItem group={g} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
