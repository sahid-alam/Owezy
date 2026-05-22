import { Routes, Route, Navigate } from 'react-router-dom'
import OfflineBanner from './components/OfflineBanner.jsx'
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute.jsx'
import { OnboardingCompletedGate, OnboardingInProgressGate } from './components/ProfileGate.jsx'
import SignIn from './pages/SignIn.jsx'
import Home from './pages/Home.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import OnboardingIndex from './pages/onboarding/index.jsx'
import FriendsIndex from './pages/friends/index.jsx'
import FriendDetail from './pages/friends/FriendDetail.jsx'
import GroupsIndex from './pages/groups/index.jsx'
import CreateGroup from './pages/groups/CreateGroup.jsx'
import GroupDetail from './pages/groups/GroupDetail.jsx'
import EditGroup from './pages/groups/EditGroup.jsx'
import TripsIndex from './pages/trips/index.jsx'
import CreateTrip from './pages/trips/CreateTrip.jsx'
import TripDetail from './pages/trips/TripDetail.jsx'
import EditTrip from './pages/trips/EditTrip.jsx'
import TripRecap from './pages/trips/TripRecap.jsx'
import AddExpense from './pages/expenses/AddExpense.jsx'
import AiReceiptScan from './pages/expenses/AiReceiptScan.jsx'
import ExpenseDetail from './pages/expenses/ExpenseDetail.jsx'
import EditExpense from './pages/expenses/EditExpense.jsx'
import SettleUp from './pages/settlements/SettleUp.jsx'
import ConfirmSettlement from './pages/settlements/ConfirmSettlement.jsx'
import Profile from './pages/Profile.jsx'
import Notifications from './pages/Notifications.jsx'

export default function App() {
  return (
    <>
    <OfflineBanner />
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
          <Route path="/trips" element={<TripsIndex />} />
          <Route path="/trips/new" element={<CreateTrip />} />
          <Route path="/trips/:tripId" element={<TripDetail />} />
          <Route path="/trips/:tripId/edit" element={<EditTrip />} />
          <Route path="/trips/:tripId/recap" element={<TripRecap />} />
          <Route path="/groups" element={<GroupsIndex />} />
          <Route path="/groups/new" element={<CreateGroup />} />
          <Route path="/groups/:groupId" element={<GroupDetail />} />
          <Route path="/groups/:groupId/edit" element={<EditGroup />} />
          <Route path="/expenses/new" element={<AddExpense />} />
          <Route path="/expenses/scan" element={<AiReceiptScan />} />
          <Route path="/expenses/:expenseId" element={<ExpenseDetail />} />
          <Route path="/expenses/:expenseId/edit" element={<EditExpense />} />
          <Route path="/settle/:friendId" element={<SettleUp />} />
          <Route path="/settlements/:settlementId/confirm" element={<ConfirmSettlement />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        <Route element={<OnboardingInProgressGate />}>
          <Route path="/onboarding" element={<OnboardingIndex />} />
        </Route>
      </Route>
    </Routes>
    </>
  )
}
