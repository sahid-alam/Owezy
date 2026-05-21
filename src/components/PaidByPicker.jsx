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
 * Single-select paid-by picker. Only shows participants.
 * Props:
 *   participants  — array of { id, name, avatar_url }
 *   value         — currently selected profile ID
 *   onChange(id)  — called with new profile ID
 */
export default function PaidByPicker({ participants, value, onChange }) {
  return (
    <ul className="divide-y divide-gray-50">
      {participants.map(p => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onChange(p.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
          >
            <Avatar name={p.name} avatarUrl={p.avatar_url} />
            <span className="flex-1 text-sm font-medium text-left text-gray-900">{p.name}</span>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              value === p.id
                ? 'bg-indigo-600 border-indigo-600'
                : 'border-gray-300'
            }`}>
              {value === p.id && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
