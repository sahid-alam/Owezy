import { Routes, Route, Navigate } from 'react-router-dom'
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
import AddExpense from './pages/expenses/AddExpense.jsx'
import ExpenseDetail from './pages/expenses/ExpenseDetail.jsx'
import EditExpense from './pages/expenses/EditExpense.jsx'
import SettleUp from './pages/settlements/SettleUp.jsx'
import ConfirmSettlement from './pages/settlements/ConfirmSettlement.jsx'
import Profile from './pages/Profile.jsx'

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
          <Route path="/groups" element={<GroupsIndex />} />
          <Route path="/groups/new" element={<CreateGroup />} />
          <Route path="/groups/:groupId" element={<GroupDetail />} />
          <Route path="/groups/:groupId/edit" element={<EditGroup />} />
          <Route path="/expenses/new" element={<AddExpense />} />
          <Route path="/expenses/:expenseId" element={<ExpenseDetail />} />
          <Route path="/expenses/:expenseId/edit" element={<EditExpense />} />
          <Route path="/settle/:friendId" element={<SettleUp />} />
          <Route path="/settlements/:settlementId/confirm" element={<ConfirmSettlement />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route element={<OnboardingInProgressGate />}>
          <Route path="/onboarding" element={<OnboardingIndex />} />
        </Route>
      </Route>
    </Routes>
  )
}
