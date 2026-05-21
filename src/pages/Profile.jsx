import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useProfile } from '../hooks/useProfile.js'
import BottomNav from '../components/BottomNav.jsx'

export default function Profile() {
  const { signOut } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="flex flex-col min-h-screen bg-white pb-16">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
      </div>

      <div className="flex flex-col items-center py-8 px-6 gap-3">
        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-indigo-700">{initials}</span>
          }
        </div>
        <h2 className="text-xl font-bold text-gray-900">{profile?.name || '…'}</h2>
        {profile?.phone && <p className="text-sm text-gray-400">{profile.phone}</p>}
        {profile?.upi_id && <p className="text-sm text-gray-400">{profile.upi_id}</p>}
      </div>

      <div className="border-t border-gray-100 mt-4">
        <button
          onClick={signOut}
          className="w-full px-4 py-4 text-sm text-red-500 text-left hover:bg-red-50"
        >
          Sign out
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
