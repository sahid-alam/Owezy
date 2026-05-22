import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getMyNotificationPrefs, updateMyNotificationPrefs } from '../lib/notification-prefs.js'
import { useAuth } from './useAuth.js'

export function useNotificationPrefs() {
  const { user } = useAuth()

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-prefs', user?.id],
    queryFn: getMyNotificationPrefs,
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  return { prefs: prefs ?? null, isLoading }
}

export function useUpdateNotificationPref() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = ['notification-prefs', user?.id]

  return useMutation({
    mutationFn: (patch) => updateMyNotificationPrefs(user.id, patch),

    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, old => (old ? { ...old, ...patch } : old))
      return { previous }
    },

    onError: (_err, _patch, ctx) => {
      queryClient.setQueryData(key, ctx?.previous)
      toast.error("Couldn't save preference")
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
