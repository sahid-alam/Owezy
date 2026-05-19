import { useAuth } from '../hooks/useAuth.js'
import { useProfile } from '../hooks/useProfile.js'

export default function Home() {
  const { signOut } = useAuth()
  const { profile } = useProfile()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
      <h1 className="text-2xl font-bold">Hello, {profile?.name || '…'}</h1>
      <button
        onClick={signOut}
        className="text-sm text-indigo-600 hover:underline"
      >
        Sign out
      </button>
    </div>
  )
}
