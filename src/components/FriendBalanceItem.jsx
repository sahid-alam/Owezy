import { useNavigate } from 'react-router-dom'
import { formatINR } from '../lib/money.js'

export default function FriendBalanceItem({ friendId, friendName, friendAvatar, netAmount, direction }) {
  const navigate = useNavigate()
  const initials = friendName
    ? friendName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const iOwe = direction === 'i_owe'

  return (
    <button
      onClick={() => navigate(`/friends/${friendId}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50"
    >
      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {friendAvatar
          ? <img src={friendAvatar} alt={friendName} className="w-full h-full object-cover" />
          : <span className="text-sm font-semibold text-indigo-700">{initials}</span>
        }
      </div>
      <span className="flex-1 text-sm font-medium text-gray-900 text-left">{friendName}</span>
      <div className="text-right">
        <p className={`text-sm font-semibold ${iOwe ? 'text-red-500' : 'text-green-600'}`}>
          {formatINR(netAmount)}
        </p>
        <p className={`text-xs ${iOwe ? 'text-red-400' : 'text-green-500'}`}>
          {iOwe ? 'you owe' : 'owes you'}
        </p>
      </div>
    </button>
  )
}
