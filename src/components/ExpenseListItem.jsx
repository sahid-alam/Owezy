import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATEGORY_LABELS } from '../lib/schemas/expenses.js'
import { getDraftSignedUrl } from '../lib-web/receipts.js'

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

function ReceiptModal({ storagePath, onClose }) {
  const [url,     setUrl]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    getDraftSignedUrl(storagePath).then(u => {
      setUrl(u)
      setLoading(false)
      if (!u) setMissing(true)
    })
  }, [storagePath])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-8 right-0 text-white/80 text-sm"
        >
          Close ✕
        </button>
        {loading && (
          <div className="bg-white rounded-xl p-10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && missing && (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">Receipt no longer available</p>
            <p className="text-xs text-gray-300 mt-1">Photos are deleted after 30 days</p>
          </div>
        )}
        {!loading && url && (
          <img
            src={url}
            alt="Receipt"
            className="w-full rounded-xl"
            onError={() => setMissing(true)}
          />
        )}
      </div>
    </div>
  )
}

export default function ExpenseListItem({ expense, myId }) {
  const navigate = useNavigate()
  const [showReceipt, setShowReceipt] = useState(false)
  const isDeleted = !!expense.deleted_at
  const myShare = expense.splits.find(s => s.profile_id === myId)?.amount

  const dateStr = new Date(expense.date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  })

  return (
    <>
      <li
        role="button"
        onClick={() => navigate(`/expenses/${expense.id}`)}
        className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50"
      >
        <Avatar name={expense.payer?.name} avatarUrl={expense.payer?.avatar_url} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-medium truncate ${isDeleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {expense.title}
              {isDeleted && <span className="ml-1.5 text-xs text-gray-400 no-underline">(removed)</span>}
            </p>
            {expense.receipt_path && !isDeleted && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowReceipt(true) }}
                aria-label="View receipt"
                className="flex-shrink-0 text-gray-300 hover:text-indigo-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
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

      {showReceipt && (
        <ReceiptModal
          storagePath={expense.receipt_path}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </>
  )
}
