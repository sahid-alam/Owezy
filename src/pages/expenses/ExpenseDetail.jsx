import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useExpense, useSoftDeleteExpense } from '../../hooks/useExpenses.js'
import { CATEGORY_LABELS } from '../../lib/schemas/expenses.js'
import AuditLogModal from '../../components/AuditLogModal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Avatar({ name, avatarUrl, size = 'md' }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  const cls = size === 'lg' ? 'w-14 h-14 text-base' : 'w-9 h-9 text-xs'
  return (
    <div className={`${cls} rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden`}>
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        : <span className="font-medium text-indigo-700">{initials}</span>
      }
    </div>
  )
}

export default function ExpenseDetail() {
  const { expenseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id

  const { expense, isLoading } = useExpense(expenseId)
  const softDelete = useSoftDeleteExpense()

  const [showAudit, setShowAudit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (isLoading) return <Spinner />
  if (!expense) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Expense not found.</p>
      </div>
    )
  }

  const isCreator = expense.created_by === userId
  const isDeleted = !!expense.deleted_at
  const dateStr = new Date(expense.date).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Nav */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAudit(true)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Activity
          </button>
          {isCreator && !isDeleted && (
            <button
              onClick={() => navigate(`/expenses/${expenseId}/edit`)}
              className="text-sm text-indigo-600 font-medium"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        {isDeleted && (
          <div className="mb-3 px-3 py-2 bg-red-50 rounded-lg">
            <p className="text-xs text-red-600 font-medium">This expense has been removed</p>
          </div>
        )}

        <div className="flex items-start gap-4">
          <Avatar name={expense.payer?.name} avatarUrl={expense.payer?.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className={`text-xl font-bold ${isDeleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {expense.title}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {expense.payer?.name} paid ₹{Number(expense.amount).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{dateStr}</p>
            {expense.category && (
              <span className="inline-block mt-1.5 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                {CATEGORY_LABELS[expense.category] || expense.category}
              </span>
            )}
          </div>
        </div>

        {expense.notes && (
          <p className="mt-3 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">{expense.notes}</p>
        )}
      </div>

      {/* Splits */}
      <div className="border-t border-gray-100">
        <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Split</p>
        <ul className="divide-y divide-gray-50">
          {expense.splits.map(s => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={s.profile?.name} avatarUrl={s.profile?.avatar_url} size="sm" />
              <span className="flex-1 text-sm text-gray-900">{s.profile?.name || 'Unknown'}</span>
              <span className="text-sm font-medium text-gray-700">
                ₹{Number(s.amount).toLocaleString('en-IN')}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Delete — creator only, not already deleted */}
      {isCreator && !isDeleted && (
        <div className="mt-8 border-t border-gray-100">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-4 py-4 text-sm text-red-500 text-left hover:bg-red-50"
          >
            Remove expense
          </button>
        </div>
      )}

      {showAudit && (
        <AuditLogModal expenseId={expenseId} onClose={() => setShowAudit(false)} />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Remove this expense?"
          message="The expense will be marked as removed but remains visible in the activity log."
          confirmLabel="Remove"
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            try {
              await softDelete.mutateAsync(expenseId)
              setShowDeleteConfirm(false)
              navigate(-1)
            } catch {}
          }}
        />
      )}
    </div>
  )
}
