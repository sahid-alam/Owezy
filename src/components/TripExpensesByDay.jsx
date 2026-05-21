import { useNavigate } from 'react-router-dom'
import { formatINR } from '../lib/money.js'

function eachDay(startDate, endDate) {
  const days = []
  const cur  = new Date(startDate + 'T00:00:00')
  const end  = new Date(endDate   + 'T00:00:00')
  let n = 1
  while (cur <= end) {
    const yyyy = cur.getFullYear()
    const mm   = String(cur.getMonth() + 1).padStart(2, '0')
    const dd   = String(cur.getDate()).padStart(2, '0')
    days.push({ date: `${yyyy}-${mm}-${dd}`, label: `Day ${n}`, n })
    cur.setDate(cur.getDate() + 1)
    n++
  }
  return days
}

function formatDayHeading(dateStr, dayN) {
  const d = new Date(dateStr + 'T00:00:00')
  const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  return `Day ${dayN} · ${label}`
}

export default function TripExpensesByDay({ trip, expenses }) {
  const navigate = useNavigate()
  const days = eachDay(trip.start_date, trip.end_date)

  return (
    <div>
      {days.map(({ date, n }) => {
        const dayExpenses = expenses.filter(e => e.date === date)
        const dayTotal    = dayExpenses.reduce((s, e) => s + Number(e.amount), 0)
        const over        = trip.daily_budget && dayTotal > Number(trip.daily_budget)
        const remaining   = trip.daily_budget ? Number(trip.daily_budget) - dayTotal : null

        return (
          <div key={date} className="border-b border-gray-50">
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
              <div className="flex items-center gap-2">
                {over && <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />}
                <p className="text-xs font-semibold text-gray-500">{formatDayHeading(date, n)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-gray-700">{dayTotal > 0 ? formatINR(dayTotal) : '—'}</p>
                {remaining !== null && dayTotal > 0 && (
                  <p className={`text-xs ${over ? 'text-red-500' : 'text-green-600'}`}>
                    {over
                      ? `${formatINR(Math.abs(remaining))} over`
                      : `${formatINR(remaining)} left`}
                  </p>
                )}
              </div>
            </div>

            {/* Expenses */}
            {dayExpenses.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400">No expenses on Day {n}</p>
            ) : (
              <ul>
                {dayExpenses.map(exp => (
                  <li key={exp.id}>
                    <button
                      onClick={() => navigate(`/expenses/${exp.id}`)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{exp.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Paid by {exp.payer?.name || 'Unknown'}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 ml-3">{formatINR(exp.amount)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
