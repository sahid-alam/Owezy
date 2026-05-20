import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute.jsx'
import { OnboardingCompletedGate, OnboardingInProgressGate } from './components/ProfileGate.jsx'
import SignIn from './pages/SignIn.jsx'
import Home from './pages/Home.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import OnboardingIndex from './pages/onboarding/index.jsx'
import FriendsIndex from './pages/friends/index.jsx'
import FriendDetail from './pages/friends/FriendDetail.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<PublicRoute />}>
        <Route path="/signin" element={<SignIn />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<OnboardingCompletedGate />}>
          <Route path="/home" element={<Home />} />
          <Route path="/friends" element={<FriendsIndex />} />
          <Route path="/friends/:friendId" element={<FriendDetail />} />
        </Route>

        <Route element={<OnboardingInProgressGate />}>
          <Route path="/onboarding" element={<OnboardingIndex />} />
        </Route>
      </Route>
    </Routes>
  )
}
