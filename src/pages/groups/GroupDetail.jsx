import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth.js'
import { useGroup, useGroupMembers } from '../../hooks/useGroups.js'
import { useGroupExpenses } from '../../hooks/useExpenses.js'
import { promoteToAdmin as promoteToAdminFn, leaveGroup as leaveGroupFn } from '../../lib/groups.js'
import MemberListItem from '../../components/MemberListItem.jsx'
import ExpenseList from '../../components/ExpenseList.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import AddGroupMember from './AddGroupMember.jsx'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-medium text-indigo-700">{initials}</span>
    </div>
  )
}

export default function GroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  const { group, isLoading: groupLoading, archiveGroup } = useGroup(groupId)
  const {
    members, isAdmin, isLoading: membersLoading,
    addMember, removeMember, promoteToAdmin, demoteFromAdmin, leaveGroup,
  } = useGroupMembers(groupId)
  const { expenses, isLoading: expensesLoading } = useGroupExpenses(groupId)

  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmState, setConfirmState] = useState(null) // null | { type, profileId?, name? }
  const [leaveIntent, setLeaveIntent] = useState(null)   // null | 'confirm' | 'transfer'
  const [showAddMember, setShowAddMember] = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)

  const isOnlyAdmin = useMemo(() => {
    const admins = members.filter(m => m.role === 'admin')
    return admins.length === 1 && admins[0]?.profile_id === userId
  }, [members, userId])

  const nonAdminMembers = useMemo(
    () => members.filter(m => m.role !== 'admin'),
    [members]
  )

  const memberProfileIds = useMemo(() => members.map(m => m.profile_id), [members])

  function handleLeaveClick() {
    setMenuOpen(false)
    setLeaveIntent(isOnlyAdmin ? 'transfer' : 'confirm')
  }

  async function handleTransferAndLeave(targetProfileId) {
    setTransferLoading(true)
    try {
      await promoteToAdminFn(groupId, targetProfileId)
      await leaveGroupFn(groupId)
      queryClient.invalidateQueries({ queryKey: ['groups', userId] })
      toast.success('Left group')
      navigate('/groups')
    } catch {
      toast.error("Couldn't complete — try again")
    } finally {
      setTransferLoading(false)
    }
  }

  async function handleConfirm() {
    if (!confirmState) return
    if (confirmState.type === 'archive') {
      try {
        await archiveGroup.mutateAsync()
        setConfirmState(null)
        navigate('/groups')
      } catch {}
    } else if (confirmState.type === 'leave') {
      try {
        await leaveGroup.mutateAsync()
        setConfirmState(null)
        navigate('/groups')
      } catch {}
    } else if (confirmState.type === 'remove') {
      try {
        await removeMember.mutateAsync(confirmState.profileId)
        setConfirmState(null)
      } catch {}
    }
  }

  if (groupLoading || membersLoading) return <Spinner />
  if (!group) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Group not found.</p>
      </div>
    )
  }

  const initials = group.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">
          ← Back
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[160px] py-1 z-20">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => { setMenuOpen(false); navigate(`/groups/${groupId}/edit`) }}
                      className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                    >
                      Edit group
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); setConfirmState({ type: 'archive' }) }}
                      className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                    >
                      Archive group
                    </button>
                  </>
                )}
                <button
                  onClick={handleLeaveClick}
                  className="w-full px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50"
                >
                  Leave group
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col items-center py-6 px-6 gap-2">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
          <span className="text-2xl font-bold text-indigo-700">{initials}</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center">{group.name}</h2>
        {group.description && (
          <p className="text-sm text-gray-400 text-center">{group.description}</p>
        )}
        <p className="text-xs text-gray-400">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </p>
      </div>

      {/* Members */}
      <div className="border-t border-gray-100">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Members</p>
          {isAdmin && (
            <button
              onClick={() => setShowAddMember(true)}
              className="text-sm text-indigo-600 font-medium"
            >
              + Add someone
            </button>
          )}
        </div>
        <ul>
          {members.map(m => (
            <MemberListItem
              key={m.profile_id}
              member={m}
              isCallerAdmin={isAdmin}
              isCurrentUser={m.profile_id === userId}
              onPromote={(pid) => promoteToAdmin.mutate(pid)}
              onDemote={(pid) => demoteFromAdmin.mutate(pid)}
              onRemove={(pid, name) => setConfirmState({ type: 'remove', profileId: pid, name })}
            />
          ))}
        </ul>
      </div>

      {/* Expenses */}
      <div className="border-t border-gray-100 mt-4">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Expenses</p>
          <button
            onClick={() => navigate(`/expenses/new?groupId=${groupId}`)}
            className="text-sm text-indigo-600 font-medium"
          >
            + Add
          </button>
        </div>
        <ExpenseList
          expenses={expenses}
          myId={userId}
          onAdd={() => navigate(`/expenses/new?groupId=${groupId}`)}
          emptyMessage="No expenses yet — add the first one"
        />
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <ConfirmDialog
          title={
            confirmState.type === 'archive' ? `Archive "${group.name}"?` :
            confirmState.type === 'leave' ? `Leave "${group.name}"?` :
            `Remove ${confirmState.name}?`
          }
          message={
            confirmState.type === 'archive' ? "This group won't appear in the active list." :
            confirmState.type === 'leave' ? "You'll be removed from the group." :
            "They'll be removed from the group."
          }
          confirmLabel={
            confirmState.type === 'archive' ? 'Archive' :
            confirmState.type === 'leave' ? 'Leave' :
            'Remove'
          }
          onCancel={() => setConfirmState(null)}
          onConfirm={handleConfirm}
        />
      )}

      {/* Normal leave confirm */}
      {leaveIntent === 'confirm' && (
        <ConfirmDialog
          title={`Leave "${group.name}"?`}
          message="You'll be removed from the group."
          confirmLabel="Leave"
          onCancel={() => setLeaveIntent(null)}
          onConfirm={async () => {
            try {
              await leaveGroup.mutateAsync()
              setLeaveIntent(null)
              navigate('/groups')
            } catch {}
          }}
        />
      )}

      {/* Transfer-and-leave sheet */}
      {leaveIntent === 'transfer' && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => !transferLoading && setLeaveIntent(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] flex flex-col">
            <div className="px-4 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">You're the only admin</h3>
              <p className="text-sm text-gray-500 mt-1">
                Promote someone — you'll leave automatically.
              </p>
            </div>
            <div className="overflow-y-auto flex-1">
              {nonAdminMembers.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-400 text-center">
                  No other members to promote. Remove the group or add someone first.
                </p>
              ) : (
                <ul>
                  {nonAdminMembers.map(m => (
                    <li key={m.profile_id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                      <Avatar name={m.profile?.name} />
                      <span className="flex-1 text-sm font-medium text-gray-900">{m.profile?.name}</span>
                      <button
                        disabled={transferLoading}
                        onClick={() => handleTransferAndLeave(m.profile_id)}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 flex-shrink-0"
                      >
                        {transferLoading ? 'Working…' : 'Make admin & leave'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                disabled={transferLoading}
                onClick={() => setLeaveIntent(null)}
                className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add member sheet */}
      {showAddMember && (
        <AddGroupMember
          currentMemberProfileIds={memberProfileIds}
          isPending={addMember.isPending}
          onAdd={(profileId) => {
            addMember.mutate(profileId, {
              onSuccess: () => setShowAddMember(false),
            })
          }}
          onClose={() => setShowAddMember(false)}
        />
      )}
    </div>
  )
}
