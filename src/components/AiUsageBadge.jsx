import { useAiUsageCount } from '../hooks/useAiUsage.js'

/**
 * Small pill showing "X/20 today". Hidden when count = 0.
 * Turns amber at 16+, red at 20.
 */
export default function AiUsageBadge() {
  const { count, isNearLimit, isAtLimit } = useAiUsageCount()
  if (!count) return null

  const color = isAtLimit
    ? 'bg-red-100 text-red-600'
    : isNearLimit
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-100 text-gray-500'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {count}/20 today
    </span>
  )
}
