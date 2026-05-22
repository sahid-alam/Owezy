import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeToOnline } from '../lib-web/offline.js'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const queryClient = useQueryClient()

  useEffect(() => {
    return subscribeToOnline((online) => {
      setIsOnline(online)
      if (online) {
        // Back online — refresh all stale server state
        queryClient.invalidateQueries()
      }
    })
  }, [queryClient])

  return { isOnline }
}
