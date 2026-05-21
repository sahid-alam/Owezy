import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGroup } from '../../hooks/useGroups.js'
import { groupFormSchema } from '../../lib/schemas/groups.js'

export default function EditGroup() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { group, isLoading, updateGroup } = useGroup(groupId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (group) {
      setName(group.name || '')
      setDescription(group.description || '')
    }
  }, [group])

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
      await updateGroup.mutateAsync(result.data)
      navigate(`/groups/${groupId}`)
    } catch {}
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">
          Cancel
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900 text-center">Edit group</h1>
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
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 resize-none"
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
        </div>

        <button
          type="submit"
          disabled={updateGroup.isPending || !name.trim()}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {updateGroup.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
