import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useProfile } from '../hooks/useProfile.js'
import { isProfileComplete } from '../lib/profile.js'

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

/** Wraps /home — redirects to /onboarding if profile is incomplete. */
export function OnboardingCompletedGate() {
  const { user } = useAuth()
  const { profile, isLoading } = useProfile()

  if (isLoading || (user && !profile)) return <Spinner />
  if (!isProfileComplete(profile)) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/** Wraps /onboarding — redirects to /home only after wizard is fully completed. */
export function OnboardingInProgressGate() {
  const { user } = useAuth()
  const { profile, isLoading } = useProfile()

  if (isLoading || (user && !profile)) return <Spinner />
  if (profile?.onboarding_completed) return <Navigate to="/home" replace />
  return <Outlet />
}
