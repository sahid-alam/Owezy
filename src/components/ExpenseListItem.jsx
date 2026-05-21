import { useNavigate } from 'react-router-dom'
import { CATEGORY_LABELS } from '../lib/schemas/expenses.js'

function Avatar({ name, avatarUrl, size = 'sm' }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  const cls = size === 'sm'
    ? 'w-8 h-8 text-xs'
    : 'w-10 h-10 text-sm'
  return (
    <div className={`${cls} rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        : <span className="font-medium text-indigo-700">{initials}</span>
      }
    </div>
  )
}

export default function ExpenseListItem({ expense, myId }) {
  const navigate = useNavigate()
  const isDeleted = !!expense.deleted_at
  const myShare = expense.splits.find(s => s.profile_id === myId)?.amount

  const dateStr = new Date(expense.date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  })

  return (
    <li
      role="button"
      onClick={() => navigate(`/expenses/${expense.id}`)}
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50"
    >
      <Avatar name={expense.payer?.name} avatarUrl={expense.payer?.avatar_url} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isDeleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {expense.title}
          {isDeleted && <span className="ml-1.5 text-xs text-gray-400 no-underline">(removed)</span>}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {expense.category ? `${CATEGORY_LABELS[expense.category]} · ` : ''}
          {dateStr}
          {expense.payer && ` · ${expense.payer.name} paid`}
        </p>
      </div>

      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
        <span className={`text-sm font-semibold ${isDeleted ? 'text-gray-300' : 'text-gray-900'}`}>
          ₹{Number(expense.amount).toLocaleString('en-IN')}
        </span>
        {myShare !== undefined && !isDeleted && (
          <span className="text-xs text-gray-400">
            your ₹{Number(myShare).toLocaleString('en-IN')}
          </span>
        )}
      </div>
    </li>
  )
}
