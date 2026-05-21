import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatINR } from '../lib/money.js'

export default function PendingConfirmationsList({ settlements }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  if (!settlements || settlements.length === 0) return null

  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
            {settlements.length}
          </span>
          <span className="text-sm font-medium text-amber-700">Pending confirmations</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <ul>
          {settlements.map(s => (
            <li key={s.id}>
              <button
                onClick={() => navigate(`/settlements/${s.id}/confirm`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-t border-gray-50"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {s.payer?.name || 'Someone'} paid you {formatINR(s.amount)}
                  </p>
                  {s.note && <p className="text-xs text-gray-400">{s.note}</p>}
                </div>
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
