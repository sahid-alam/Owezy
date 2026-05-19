import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function ProtectedRoute() {
  const { session, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (!session) return <Navigate to="/signin" replace />
  return <Outlet />
}

export function PublicRoute() {
  const { session, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (session) return <Navigate to="/home" replace />
  return <Outlet />
}
