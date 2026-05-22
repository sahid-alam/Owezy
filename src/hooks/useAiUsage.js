import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth.js'
import { getMyUsageCount } from '../lib/ai-client.js'

const AI_DAILY_LIMIT = 20
const AI_WARN_AT     = 16

export function useAiUsageCount() {
  const { user } = useAuth()

  const { data: count = 0 } = useQuery({
    queryKey:  ['ai-usage', user?.id],
    queryFn:   () => getMyUsageCount(),
    enabled:   !!user?.id,
    staleTime: 30_000,
  })

  return {
    count,
    isNearLimit: count >= AI_WARN_AT,
    isAtLimit:   count >= AI_DAILY_LIMIT,
  }
}
