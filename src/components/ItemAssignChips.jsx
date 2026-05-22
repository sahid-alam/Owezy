import { generateInitials, getAvatarColor } from '../lib/avatar.js'

/**
 * Tap-to-assign UI — each item row has mini avatar chips below it.
 * Tap a chip to toggle that person's assignment to that item.
 *
 * Props:
 *   items        — [{ name, price, quantity }]
 *   participants — [{ id, name, avatar_url }]
 *   assignments  — { [itemIndex]: Set<profileId> }
 *   onChange(itemIndex, profileId, assigned: boolean) — called on each toggle
 */
export default function ItemAssignChips({ items, participants, assignments, onChange }) {
  if (!items?.length || !participants?.length) return null

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const assigned = assignments[idx] ?? new Set()
        return (
          <div key={idx} className="border border-gray-100 rounded-xl p-3">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-medium text-gray-900">{item.name}</p>
              <p className="text-sm text-gray-500 ml-2 shrink-0">
                ₹{Number(item.price).toFixed(0)}
                {item.quantity > 1 ? ` ×${item.quantity}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => {
                const isAssigned = assigned.has(p.id)
                const initials   = generateInitials(p.name)
                const bg         = getAvatarColor(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChange(idx, p.id, !isAssigned)}
                    aria-pressed={isAssigned}
                    className={`
                      flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                      border transition-all
                      ${isAssigned
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                      }
                    `}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.name}
                        className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: isAssigned ? 'rgba(255,255,255,0.3)' : bg, fontSize: 8 }}
                      >
                        {initials}
                      </span>
                    )}
                    {p.name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
