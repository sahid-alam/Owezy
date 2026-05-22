import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from './useAuth.js'
import { throwIfOffline } from '../lib-web/offline.js'
import {
  createTrip as createTripFn,
  listMyTrips,
  getTrip,
  updateTrip as updateTripFn,
  archiveTrip as archiveTripFn,
  listTripMembers,
  addTripMember as addTripMemberFn,
  removeTripMember as removeTripMemberFn,
  setTripMemberRole as setTripMemberRoleFn,
  leaveTrip as leaveTripFn,
  listTripExpenses,
  getTripBalances,
  getTripSummary,
  getTripPersonalInsights,
  computeTripInsights,
} from '../lib/trips.js'

export function useMyTrips(archived = false) {
  const { user } = useAuth()
  const userId = user?.id

  const query = useQuery({
    queryKey: ['trips', userId, { archived }],
    queryFn: () => listMyTrips(userId, { archived }),
    enabled: !!userId,
    staleTime: 60_000,
  })

  return { trips: query.data ?? [], isLoading: query.isLoading }
}

export function useTrip(tripId) {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  function inv(...keys) { keys.forEach(k => queryClient.invalidateQueries({ queryKey: k })) }

  const tripQuery = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTrip(tripId),
    enabled: !!tripId,
    staleTime: 30_000,
  })

  const updateTrip = useMutation({
    mutationFn: (patch) => { throwIfOffline(); return updateTripFn(tripId, patch) },
    onSuccess: () => {
      toast.success('Trip updated')
      inv(['trip', tripId], ['trips', userId])
    },
    onError: (err) => { if (err.message === 'OFFLINE') return; toast.error("Couldn't update trip — try again") },
  })

  const archiveTrip = useMutation({
    mutationFn: () => { throwIfOffline(); return archiveTripFn(tripId) },
    onSuccess: () => {
      toast.success('Trip archived')
      inv(['trips', userId])
    },
    onError: (err) => { if (err.message === 'OFFLINE') return; toast.error("Couldn't archive trip — try again") },
  })

  return {
    trip: tripQuery.data ?? null,
    isLoading: tripQuery.isLoading,
    updateTrip,
    archiveTrip,
  }
}

export function useTripMembers(tripId) {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  function inv(...keys) { keys.forEach(k => queryClient.invalidateQueries({ queryKey: k })) }

  const membersQuery = useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: () => listTripMembers(tripId),
    enabled: !!tripId,
    staleTime: 30_000,
  })

  const members = membersQuery.data ?? []
  const callerMember = members.find(m => m.profile_id === userId)
  const isAdmin = callerMember?.role === 'admin'

  const addMember = useMutation({
    mutationFn: (profileId) => { throwIfOffline(); return addTripMemberFn(tripId, profileId) },
    onSuccess: () => {
      toast.success('Member added')
      inv(['trip-members', tripId], ['trips', userId])
    },
    onError: (err) => {
      if (err.message === 'OFFLINE') return
      const msgs = {
        NOT_ADMIN:      "You're not an admin",
        ALREADY_MEMBER: 'Already in this trip',
      }
      toast.error(msgs[err.message] ?? "Couldn't add member — try again")
    },
  })

  const removeMember = useMutation({
    mutationFn: (profileId) => { throwIfOffline(); return removeTripMemberFn(tripId, profileId) },
    onSuccess: () => {
      toast.success('Removed from trip')
      inv(['trip-members', tripId])
    },
    onError: (err) => { if (err.message === 'OFFLINE') return; toast.error("Couldn't remove member — try again") },
  })

  const setMemberRole = useMutation({
    mutationFn: ({ profileId, role }) => { throwIfOffline(); return setTripMemberRoleFn(tripId, profileId, role) },
    onSuccess: (_, { role }) => {
      toast.success(role === 'admin' ? 'Made admin' : 'Removed as admin')
      inv(['trip-members', tripId])
    },
    onError: (err) => {
      if (err.message === 'OFFLINE') return
      toast.error(
        err.message === 'LAST_ADMIN'
          ? "You're the only admin — promote someone first"
          : "Couldn't update role — try again"
      )
    },
  })

  const leaveTrip = useMutation({
    mutationFn: () => { throwIfOffline(); return leaveTripFn(tripId) },
    onSuccess: () => {
      toast.success('Left trip')
      inv(['trips', userId])
    },
    onError: (err) => {
      if (err.message === 'OFFLINE') return
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
    setMemberRole,
    leaveTrip,
  }
}

export function useCreateTrip() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vals) => { throwIfOffline(); return createTripFn(vals) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', userId] })
    },
    onError: (err) => {
      if (err.message === 'OFFLINE') return
      toast.error(
        err.message === 'INVALID_DATES'
          ? 'End date must be on or after start date'
          : "Couldn't create trip — try again"
      )
    },
  })
}

export function useTripExpenses(tripId) {
  const query = useQuery({
    queryKey: ['trip-expenses', tripId],
    queryFn: () => listTripExpenses(tripId),
    enabled: !!tripId,
    staleTime: 30_000,
  })
  return { expenses: query.data ?? [], isLoading: query.isLoading }
}

export function useTripBalances(tripId) {
  const query = useQuery({
    queryKey: ['trip-balances', tripId],
    queryFn: () => getTripBalances(tripId),
    enabled: !!tripId,
    staleTime: 30_000,
  })
  return { balances: query.data ?? [], isLoading: query.isLoading }
}

export function useTripSummary(tripId) {
  const query = useQuery({
    queryKey: ['trip-summary', tripId],
    queryFn: () => getTripSummary(tripId),
    enabled: !!tripId,
    staleTime: 60_000,
  })
  return { summary: query.data ?? null, isLoading: query.isLoading }
}

export function useTripInsights(tripId) {
  const query = useQuery({
    queryKey: ['trip-insights', tripId],
    queryFn: async () => {
      const raw = await getTripPersonalInsights(tripId)
      return computeTripInsights(raw)
    },
    enabled: !!tripId,
    staleTime: 60_000,
  })
  return { insights: query.data ?? [], isLoading: query.isLoading }
}
