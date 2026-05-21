import { useExpenseAudit } from '../hooks/useExpenses.js'

const ACTION_LABELS = {
  created:     'Added expense',
  edited:      'Edited expense',
  deleted:     'Removed expense',
  split_added: 'Added participant',
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function AuditEntry({ entry }) {
  const label = ACTION_LABELS[entry.action] ?? entry.action
  const time = new Date(entry.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const editorName = entry.editor?.name || 'Someone'

  return (
    <div className="px-4 py-3 border-b border-gray-50">
      <div className="flex justify-between items-start gap-2">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <span className="text-xs text-gray-400 flex-shrink-0">{time}</span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">by {editorName}</p>
      {entry.changes && entry.action === 'edited' && (
        <div className="mt-1.5 space-y-0.5">
          {Object.entries(entry.changes)
            .filter(([k]) => !k.startsWith('new_'))
            .map(([field, oldVal]) => {
              const newVal = entry.changes[`new_${field}`]
              return (
                <p key={field} className="text-xs text-gray-400">
                  {field}: <span className="line-through">{String(oldVal)}</span>
                  {' → '}<span className="text-gray-700">{String(newVal)}</span>
                </p>
              )
            })
          }
        </div>
      )}
    </div>
  )
}

export default function AuditLogModal({ expenseId, onClose }) {
  const { entries, isLoading } = useExpenseAudit(expenseId)

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Activity</h3>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Done
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <Spinner />
          ) : entries.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">No activity yet</p>
          ) : (
            <div>
              {entries.map(e => <AuditEntry key={e.id} entry={e} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
