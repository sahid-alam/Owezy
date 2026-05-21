function Avatar({ name, avatarUrl }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        : <span className="text-xs font-medium text-indigo-700">{initials}</span>
      }
    </div>
  )
}

/**
 * Multi-select participant picker.
 * Props:
 *   candidates    — array of { id, name, avatar_url }
 *   selected      — Set of selected profile IDs
 *   lockedIds     — Set of profile IDs that cannot be deselected (e.g. self)
 *   onChange(Set) — called with full new Set
 */
export default function ParticipantPicker({ candidates, selected, lockedIds = new Set(), onChange }) {
  function toggle(id) {
    if (lockedIds.has(id)) return
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onChange(next)
  }

  return (
    <ul className="divide-y divide-gray-50">
      {candidates.map(c => {
        const isSelected = selected.has(c.id)
        const isLocked = lockedIds.has(c.id)
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => toggle(c.id)}
              disabled={isLocked}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 disabled:cursor-default"
            >
              <Avatar name={c.name} avatarUrl={c.avatar_url} />
              <span className="flex-1 text-sm font-medium text-left text-gray-900">{c.name}</span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'border-gray-300'
              }`}>
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
