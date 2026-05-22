import Toggle from './Toggle.jsx'

/**
 * A labeled card showing a list of notification preference toggles.
 * Props:
 *   title    — section heading (e.g. "Expenses")
 *   prefs    — [{ key, label }] items from NOTIFICATION_PREF_MAP for this section
 *   values   — the notification_prefs row (null while loading)
 *   onChange — (key: string, value: boolean) => void
 */
export default function PrefToggleGroup({ title, prefs, values, onChange }) {
  return (
    <div className="border-t border-gray-100">
      <p className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </p>
      {prefs.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between px-4 py-3">
          <p className="text-sm text-gray-700">{label}</p>
          <Toggle
            checked={values ? (values[key] ?? true) : true}
            disabled={!values}
            onChange={(val) => onChange(key, val)}
          />
        </div>
      ))}
    </div>
  )
}
