import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateGroup } from '../../hooks/useGroups.js'
import { groupFormSchema } from '../../lib/schemas/groups.js'

export default function CreateGroup() {
  const navigate = useNavigate()
  const createGroup = useCreateGroup()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    const result = groupFormSchema.safeParse({ name, description })
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors
      setErrors({ name: flat.name?.[0], description: flat.description?.[0] })
      return
    }
    setErrors({})
    try {
      const group = await createGroup.mutateAsync(result.data)
      navigate(`/groups/${group.id}`, { replace: true })
    } catch {}
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-indigo-600 font-medium"
        >
          Cancel
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900 text-center">New group</h1>
        <div className="w-14" />
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Group name
          </label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Flatmates, Goa Trip 2026..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Description <span className="text-gray-400 normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's this group for?"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 resize-none"
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
        </div>

        <button
          type="submit"
          disabled={createGroup.isPending || !name.trim()}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {createGroup.isPending ? 'Creating…' : 'Create group'}
        </button>
      </form>
    </div>
  )
}
