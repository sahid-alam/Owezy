import ExpenseListItem from './ExpenseListItem.jsx'

function EmptyState({ message, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
      <p className="text-sm text-gray-400 text-center">{message}</p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl"
        >
          Add first expense
        </button>
      )}
    </div>
  )
}

export default function ExpenseList({ expenses, myId, onAdd, emptyMessage }) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        message={emptyMessage ?? 'No expenses yet'}
        onAdd={onAdd}
      />
    )
  }

  return (
    <ul>
      {expenses.map(e => (
        <ExpenseListItem key={e.id} expense={e} myId={myId} />
      ))}
    </ul>
  )
}
