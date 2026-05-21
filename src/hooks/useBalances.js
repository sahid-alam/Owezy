import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth.js'
import { getMyBalances, getBalanceWithFriend } from '../lib/balance.js'

export function useMyBalances() {
  const { user } = useAuth()
  const userId = user?.id

  const query = useQuery({
    queryKey: ['balances', userId],
    queryFn: getMyBalances,
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  return {
    balances: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}

export function useBalanceWithFriend(friendId) {
  const { user } = useAuth()
  const userId = user?.id

  const query = useQuery({
    queryKey: ['balance', userId, friendId],
    queryFn: () => getBalanceWithFriend(userId, friendId),
    enabled: !!userId && !!friendId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  return {
    balance: query.data ?? null,
    isLoading: query.isLoading,
  }
}
