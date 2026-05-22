import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from './useAuth.js'
import { throwIfOffline } from '../lib-web/offline.js'
import {
  listFriends, listIncomingRequests, listOutgoingRequests,
  listPendingGuestInvites, getAllActiveFriendships,
  searchProfilesByName, searchProfileByPhone,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  cancelFriendRequest, unfriend, blockFriend,
  createGuestInvite, cancelGuestInvite,
} from '../lib/friends.js'
import { normalizePhone } from '../lib/phone-format.js'

export function useFriends() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  function inv(...keys) {
    keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
  }

  const friendsQuery = useQuery({
    queryKey: ['friends', userId],
    queryFn: () => listFriends(userId),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const incomingQuery = useQuery({
    queryKey: ['friendships', 'incoming', userId],
    queryFn: () => listIncomingRequests(userId),
    enabled: !!userId,
    staleTime: 30_000,
  })

  const outgoingQuery = useQuery({
    queryKey: ['friendships', 'outgoing', userId],
    queryFn: () => listOutgoingRequests(userId),
    enabled: !!userId,
    staleTime: 30_000,
  })

  const invitesQuery = useQuery({
    queryKey: ['guest-invites', userId],
    queryFn: () => listPendingGuestInvites(userId),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const sendRequest = useMutation({
    mutationFn: (addresseeId) => { throwIfOffline(); return sendFriendRequest(addresseeId, userId) },
    onSuccess: () => {
      toast.success('Friend request sent')
      inv(['friendships', 'outgoing', userId], ['friendships', 'all-active', userId])
    },
    onError: (err) => {
      if (err.message === 'OFFLINE') return
      const msgs = {
        BLOCKED: "Can't send a request to this person",
        ALREADY_PENDING: 'Already sent a request',
        ALREADY_FRIENDS: "You're already friends",
        SELF_ADD: "You can't add yourself",
      }
      toast.error(msgs[err.message] ?? "Couldn't send request — try again")
    },
  })

  const acceptRequest = useMutation({
    mutationFn: (friendshipId) => { throwIfOffline(); return acceptFriendRequest(friendshipId) },
    onSuccess: () => {
      toast.success('Friend request accepted')
      inv(
        ['friendships', 'incoming', userId],
        ['friends', userId],
        ['friendships', 'all-active', userId],
      )
    },
    onError: (err) => { if (err.message === 'OFFLINE') return; toast.error("Couldn't accept — try again") },
  })

  const rejectRequest = useMutation({
    mutationFn: (friendshipId) => { throwIfOffline(); return rejectFriendRequest(friendshipId) },
    onSuccess: () => {
      inv(['friendships', 'incoming', userId], ['friendships', 'all-active', userId])
    },
    onError: (err) => { if (err.message === 'OFFLINE') return; toast.error("Couldn't decline — try again") },
  })

  const cancelRequest = useMutation({
    mutationFn: (friendshipId) => { throwIfOffline(); return cancelFriendRequest(friendshipId) },
    onSuccess: () => {
      toast.success('Request cancelled')
      inv(['friendships', 'outgoing', userId], ['friendships', 'all-active', userId])
    },
    onError: (err) => { if (err.message === 'OFFLINE') return; toast.error("Couldn't cancel — try again") },
  })

  const unfriendMutation = useMutation({
    mutationFn: (friendshipId) => { throwIfOffline(); return unfriend(friendshipId) },
    onSuccess: () => {
      inv(['friends', userId], ['friendships', 'all-active', userId])
    },
    onError: (err) => { if (err.message === 'OFFLINE') return; toast.error("Couldn't remove friend — try again") },
  })

  const blockMutation = useMutation({
    mutationFn: (friendshipId) => { throwIfOffline(); return blockFriend(friendshipId) },
    onSuccess: () => {
      inv(['friends', userId], ['friendships', 'all-active', userId])
    },
    onError: (err) => { if (err.message === 'OFFLINE') return; toast.error("Couldn't block — try again") },
  })

  const createInvite = useMutation({
    mutationFn: (phone) => { throwIfOffline(); return createGuestInvite(phone, userId) },
    onSuccess: () => {
      toast.success('Invite created')
      inv(['guest-invites', userId])
    },
    onError: (err) => {
      if (err.message === 'OFFLINE') return
      const msgs = {
        BLOCKED: "Can't invite this number",
        INVALID_PHONE: 'Enter a valid phone number',
        INVITE_EXISTS: 'Already invited this number',
      }
      toast.error(msgs[err.message] ?? "Couldn't send invite — try again")
    },
  })

  const cancelInvite = useMutation({
    mutationFn: (inviteId) => { throwIfOffline(); return cancelGuestInvite(inviteId) },
    onSuccess: () => inv(['guest-invites', userId]),
    onError: (err) => { if (err.message === 'OFFLINE') return; toast.error("Couldn't cancel invite — try again") },
  })

  return {
    friends: friendsQuery.data ?? [],
    incoming: incomingQuery.data ?? [],
    outgoing: outgoingQuery.data ?? [],
    invites: invitesQuery.data ?? [],
    isLoading: friendsQuery.isLoading,
    incomingCount: incomingQuery.data?.length ?? 0,
    sendRequest: sendRequest.mutate,
    acceptRequest: acceptRequest.mutate,
    rejectRequest: rejectRequest.mutate,
    cancelRequest: cancelRequest.mutate,
    unfriend: unfriendMutation.mutate,
    blockFriend: blockMutation.mutate,
    createInvite: createInvite.mutate,
    cancelInvite: cancelInvite.mutate,
  }
}

export function useFriendSearch(rawQuery) {
  const { user } = useAuth()
  const userId = user?.id
  const query = useDeferredValue(rawQuery.trim())
  const normalizedPhone = normalizePhone(query)
  const isPhone = !!normalizedPhone
  const enabled = !!userId && query.length >= 1

  // Always-on: all active friendships for blocked-ID derivation and status map
  const allFriendshipsQuery = useQuery({
    queryKey: ['friendships', 'all-active', userId],
    queryFn: () => getAllActiveFriendships(userId),
    enabled: !!userId,
    staleTime: 30_000,
  })

  const allFriendships = allFriendshipsQuery.data ?? []

  const blockedIds = useMemo(
    () =>
      allFriendships
        .filter(f => f.status === 'blocked')
        .map(f => (f.requester_id === userId ? f.addressee_id : f.requester_id)),
    [allFriendships, userId],
  )

  // friendshipMap: { [otherUserId]: { friendshipId, status, iAmRequester } }
  const friendshipMap = useMemo(() => {
    const map = {}
    for (const f of allFriendships) {
      const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id
      map[otherId] = {
        friendshipId: f.id,
        status: f.status,
        iAmRequester: f.requester_id === userId,
      }
    }
    return map
  }, [allFriendships, userId])

  const searchQuery = useQuery({
    queryKey: [
      'profile-search',
      isPhone ? 'phone' : 'name',
      isPhone ? normalizedPhone : query,
      blockedIds,
    ],
    queryFn: () =>
      isPhone
        ? searchProfileByPhone(normalizedPhone, userId, blockedIds).then(r => (r ? [r] : []))
        : searchProfilesByName(query, userId, blockedIds),
    enabled: enabled && !allFriendshipsQuery.isLoading,
  })

  return {
    results: searchQuery.data ?? [],
    isLoading: searchQuery.isLoading || allFriendshipsQuery.isLoading,
    friendshipMap,
    isPhone,
    normalizedPhone,
  }
}
