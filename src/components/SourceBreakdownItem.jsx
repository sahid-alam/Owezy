import { useNavigate } from 'react-router-dom'
import { formatINR } from '../lib/money.js'

export default function SourceBreakdownItem({ expenseId, title, amount, date }) {
  const navigate = useNavigate()
  const formatted = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <button
      onClick={() => navigate(`/expenses/${expenseId}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50"
    >
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-400">{formatted}</p>
      </div>
      <span className="text-sm font-medium text-gray-700">{formatINR(amount)}</span>
    </button>
  )
}
