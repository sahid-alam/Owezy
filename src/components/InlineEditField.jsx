import { useState } from 'react'

/**
 * Tap-to-edit field with explicit Save / Cancel.
 * Props:
 *   label       — section label (uppercase)
 *   value       — current saved value (string | null)
 *   schema      — z.object({ fieldKey: ZodType }) — single-field Zod object schema
 *   onSave      — async (trimmedValue: string) => void
 *   type        — input type (default 'text')
 *   placeholder — placeholder shown in display mode when value is empty
 */
export default function InlineEditField({ label, value, schema, onSave, type = 'text', placeholder }) {
  const [editing, setEditing]   = useState(false)
  const [draft,   setDraft]     = useState('')
  const [error,   setError]     = useState('')
  const [saving,  setSaving]    = useState(false)

  const fieldKey = Object.keys(schema.shape)[0]

  function validate(val) {
    const result = schema.safeParse({ [fieldKey]: val })
    return result.success ? '' : (result.error.issues[0]?.message ?? 'Invalid')
  }

  function beginEdit() {
    setDraft(value ?? '')
    setError('')
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setError('')
  }

  function handleChange(e) {
    const val = e.target.value
    setDraft(val)
    setError(validate(val))
  }

  async function handleSave() {
    const trimmed = draft.trim()
    const err = validate(trimmed)
    if (err) { setError(err); return }
    setSaving(true)
    try {
      await onSave(trimmed)
      setEditing(false)
    } catch (e) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-3.5 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>

      {editing ? (
        <div>
          <input
            type={type}
            value={draft}
            onChange={handleChange}
            placeholder={placeholder}
            autoFocus
            className="w-full text-sm text-gray-900 outline-none border-b-2 border-indigo-500 pb-1 bg-transparent"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <div className="flex items-center gap-4 mt-2.5">
            <button
              onClick={handleSave}
              disabled={saving || !!error}
              className="text-sm font-semibold text-indigo-600 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancel} className="text-sm text-gray-400">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className={`text-sm flex-1 ${value ? 'text-gray-900' : 'text-gray-300'}`}>
            {value || placeholder || 'Not set'}
          </p>
          <button
            onClick={beginEdit}
            aria-label={`Edit ${label}`}
            className="flex-shrink-0 p-1 -mr-1 text-gray-400 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
