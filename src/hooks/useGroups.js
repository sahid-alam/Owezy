import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from './useAuth.js'
import {
  createGroup as createGroupFn,
  listMyGroups,
  getGroup,
  updateGroup as updateGroupFn,
  archiveGroup as archiveGroupFn,
  listMembers,
  addMemberByProfile,
  removeMember as removeMemberFn,
  promoteToAdmin as promoteToAdminFn,
  demoteFromAdmin as demoteFromAdminFn,
  leaveGroup as leaveGroupFn,
} from '../lib/groups.js'

export function useMyGroups(archived = false) {
  const { user } = useAuth()
  const userId = user?.id

  const query = useQuery({
    queryKey: ['groups', userId, { archived }],
    queryFn: () => listMyGroups(userId, { archived }),
    enabled: !!userId,
    staleTime: 60_000,
  })

  return { groups: query.data ?? [], isLoading: query.isLoading }
}

export function useGroup(groupId) {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  function inv(...keys) { keys.forEach(k => queryClient.invalidateQueries({ queryKey: k })) }

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId),
    enabled: !!groupId,
    staleTime: 30_000,
  })

  const updateGroup = useMutation({
    mutationFn: (patch) => updateGroupFn(groupId, patch),
    onSuccess: () => {
      toast.success('Group updated')
      inv(['group', groupId], ['groups', userId])
    },
    onError: () => toast.error("Couldn't update — try again"),
  })

  const archiveGroup = useMutation({
    mutationFn: () => archiveGroupFn(groupId),
    onSuccess: () => {
      toast.success('Group archived')
      inv(['groups', userId])
    },
    onError: () => toast.error("Couldn't archive — try again"),
  })

  return {
    group: groupQuery.data ?? null,
    isLoading: groupQuery.isLoading,
    updateGroup,
    archiveGroup,
  }
}

export function useGroupMembers(groupId) {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  function inv(...keys) { keys.forEach(k => queryClient.invalidateQueries({ queryKey: k })) }

  const membersQuery = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => listMembers(groupId),
    enabled: !!groupId,
    staleTime: 30_000,
  })

  const members = membersQuery.data ?? []
  const callerMember = members.find(m => m.profile_id === userId)
  const isAdmin = callerMember?.role === 'admin'

  const addMember = useMutation({
    mutationFn: (profileId) => addMemberByProfile(groupId, profileId),
    onSuccess: () => {
      toast.success('Member added')
      inv(['group-members', groupId], ['groups', userId])
    },
    onError: (err) => {
      const msgs = {
        NOT_ADMIN: "You're not an admin",
        ALREADY_MEMBER: 'Already in this group',
      }
      toast.error(msgs[err.message] ?? "Couldn't add member — try again")
    },
  })

  const removeMember = useMutation({
    mutationFn: (profileId) => removeMemberFn(groupId, profileId),
    onSuccess: () => {
      toast.success('Removed from group')
      inv(['group-members', groupId])
    },
    onError: () => toast.error("Couldn't remove — try again"),
  })

  const promoteToAdmin = useMutation({
    mutationFn: (profileId) => promoteToAdminFn(groupId, profileId),
    onSuccess: () => {
      toast.success('Made admin')
      inv(['group-members', groupId])
    },
    onError: () => toast.error("Couldn't update role — try again"),
  })

  const demoteFromAdmin = useMutation({
    mutationFn: (profileId) => demoteFromAdminFn(groupId, profileId),
    onSuccess: () => {
      toast.success('Removed as admin')
      inv(['group-members', groupId])
    },
    onError: () => toast.error("Couldn't update role — try again"),
  })

  const leaveGroup = useMutation({
    mutationFn: () => leaveGroupFn(groupId),
    onSuccess: () => {
      toast.success('Left group')
      inv(['groups', userId])
    },
    onError: (err) => {
      toast.error(
        err.message === 'LAST_ADMIN'
          ? "You're the only admin — promote someone first"
          : "Couldn't leave — try again"
      )
    },
  })

  return {
    members,
    callerMember,
    isAdmin,
    isLoading: membersQuery.isLoading,
    addMember,
    removeMember,
    promoteToAdmin,
    demoteFromAdmin,
    leaveGroup,
  }
}

export function useCreateGroup() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vals) => createGroupFn(userId, vals),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', userId] })
    },
    onError: () => toast.error("Couldn't create group — try again"),
  })
}
