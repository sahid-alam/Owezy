import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession, onAuthStateChange, signOut as authSignOut } from '../lib/auth.js'

export function useAuth() {
  const queryClient = useQueryClient()

  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    staleTime: Infinity,
  })

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ['session'] })
    })
    return () => subscription.unsubscribe()
  }, [queryClient])

  async function signOut() {
    await authSignOut()
  }

  return {
    session: session ?? null,
    user: session?.user ?? null,
    isLoading,
    signOut,
  }
}
