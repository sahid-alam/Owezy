import { useOnlineStatus } from '../hooks/useOnlineStatus.js'

export default function OfflineBanner() {
  const { isOnline } = useOnlineStatus()
  if (isOnline) return null
  return (
    <div className="sticky top-0 z-50 bg-gray-800 text-white text-sm text-center py-2 px-4">
      You're offline — viewing cached data. Changes will sync when you reconnect.
    </div>
  )
}
