import { validateExactSplits } from '../lib/split-math.js'

/**
 * Props:
 *   splitType     — 'equal' | 'custom'
 *   participants  — array of { id, name, avatar_url }
 *   splits        — array of { profile_id, amount }
 *   totalAmount   — string or number (rupees)
 *   onChange(splits) — called only for custom mode
 */
export default function SplitEditor({ splitType, participants, splits, totalAmount, onChange }) {
  const profileMap = Object.fromEntries(participants.map(p => [p.id, p]))
  const total = Number(totalAmount) || 0

  const sum = splits.reduce((acc, s) => acc + Number(s.amount), 0)
  const isValid = validateExactSplits(total, splits)
  const diff = Math.round((total - sum) * 100) / 100

  if (splitType === 'equal') {
    return (
      <ul className="divide-y divide-gray-50">
        {splits.map(s => {
          const p = profileMap[s.profile_id]
          return (
            <li key={s.profile_id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xs font-medium text-indigo-700">
                {p?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </div>
              <span className="flex-1 text-sm text-gray-900">{p?.name || '—'}</span>
              <span className="text-sm font-medium text-gray-700">₹{Number(s.amount).toLocaleString('en-IN')}</span>
            </li>
          )
        })}
      </ul>
    )
  }

  // Custom split
  return (
    <div>
      <ul className="divide-y divide-gray-50">
        {splits.map(s => {
          const p = profileMap[s.profile_id]
          return (
            <li key={s.profile_id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xs font-medium text-indigo-700">
                {p?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </div>
              <span className="flex-1 text-sm text-gray-900">{p?.name || '—'}</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-400">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={s.amount}
                  onChange={e => {
                    const next = splits.map(x =>
                      x.profile_id === s.profile_id
                        ? { ...x, amount: e.target.value }
                        : x
                    )
                    onChange(next)
                  }}
                  className="w-24 text-right text-sm font-medium border-b border-gray-300 focus:border-indigo-500 outline-none py-0.5 bg-transparent"
                />
              </div>
            </li>
          )
        })}
      </ul>

      {/* Running sum */}
      <div className={`mx-4 mt-2 flex justify-between text-xs px-3 py-2 rounded-lg ${
        isValid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
      }`}>
        <span>Total split</span>
        <span>
          ₹{sum.toLocaleString('en-IN')} / ₹{total.toLocaleString('en-IN')}
          {!isValid && diff !== 0 && (
            <span className="ml-1">({diff > 0 ? `₹${diff} left` : `₹${Math.abs(diff)} over`})</span>
          )}
        </span>
      </div>
    </div>
  )
}
