import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth.js'
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  subscribeToNotifications,
} from '../lib/notifications.js'

export function useNotifications() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  // Realtime subscription: invalidate both the list and unread count on new insert
  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToNotifications(userId, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', userId, 'unread'] })
    })
    return unsubscribe
  }, [userId, queryClient])

  const query = useQuery({
    queryKey: ['notifications', userId],
    queryFn:  () => listNotifications({ limit: 30 }),
    enabled:  !!userId,
    staleTime: 30_000,
  })

  return {
    notifications: query.data || [],
    isLoading:     query.isLoading,
  }
}

export function useUnreadCount() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToNotifications(userId, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId, 'unread'] })
    })
    return unsubscribe
  }, [userId, queryClient])

  return useQuery({
    queryKey:  ['notifications', userId, 'unread'],
    queryFn:   getUnreadCount,
    enabled:   !!userId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useMarkRead() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markRead,
    // Optimistic: flip the unread dot immediately
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', userId] })
      const prev = queryClient.getQueryData(['notifications', userId])
      queryClient.setQueryData(['notifications', userId], (old) => {
        if (!old) return old
        return old.map((n) =>
          n.id === notificationId
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      })
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['notifications', userId], ctx.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId, 'unread'] })
    },
  })
}

export function useMarkAllRead() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications', userId, 'unread'] })
    },
  })
}
