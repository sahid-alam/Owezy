import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../hooks/useAuth.js'
import { useGroupMembers } from '../../hooks/useGroups.js'
import { useFriends } from '../../hooks/useFriends.js'
import { useCreateExpense } from '../../hooks/useExpenses.js'
import { expenseFormSchema, CATEGORIES, CATEGORY_LABELS } from '../../lib/schemas/expenses.js'
import { computeEqualSplit, validateExactSplits } from '../../lib/split-math.js'
import ParticipantPicker from '../../components/ParticipantPicker.jsx'
import PaidByPicker from '../../components/PaidByPicker.jsx'
import SplitEditor from '../../components/SplitEditor.jsx'

function Section({ title, children }) {
  return (
    <div className="border-t border-gray-100">
      <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

export default function AddExpense() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const groupId = params.get('groupId')
  const friendId = params.get('friendId')
  const { user } = useAuth()
  const userId = user?.id

  // Load candidates based on context
  const { members: groupMembers, isLoading: groupLoading } = useGroupMembers(groupId)
  const { friends, isLoading: friendsLoading } = useFriends()

  const candidates = useMemo(() => {
    if (groupId) {
      return groupMembers
        .filter(m => !m.deleted_at)
        .map(m => ({ id: m.profile_id, name: m.profile?.name, avatar_url: m.profile?.avatar_url }))
    }
    // Friend expense: self + the specific friend
    const selfProfile = { id: userId, name: user?.user_metadata?.name || 'You', avatar_url: null }
    if (friendId) {
      const friend = friends.find(f => f.friend.id === friendId)
      return friend
        ? [selfProfile, { id: friend.friend.id, name: friend.friend.name, avatar_url: friend.friend.avatar_url }]
        : [selfProfile]
    }
    return [selfProfile]
  }, [groupId, friendId, groupMembers, friends, userId, user])

  const [selectedIds, setSelectedIds] = useState(() => new Set([userId]))
  const [paidBy, setPaidBy] = useState(userId)

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      title: '',
      amount: '',
      paid_by: userId,
      category: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      split_type: 'equal',
    },
  })

  const amount = watch('amount')
  const splitType = watch('split_type')

  const participants = useMemo(
    () => candidates.filter(c => selectedIds.has(c.id)),
    [candidates, selectedIds]
  )

  const [customSplits, setCustomSplits] = useState([])

  const equalSplits = useMemo(
    () => computeEqualSplit(amount, participants.map(p => p.id), paidBy),
    [amount, participants, paidBy]
  )

  // When switching to custom, seed from equal
  function handleSplitTypeChange(e) {
    if (e.target.value === 'custom' && customSplits.length === 0) {
      setCustomSplits(equalSplits)
    }
  }

  // Sync custom splits when participants change in custom mode
  const activeSplits = splitType === 'equal' ? equalSplits : customSplits

  const createExpense = useCreateExpense()
  const isLoading = groupLoading || friendsLoading

  async function onSubmit(data) {
    if (splitType === 'custom' && !validateExactSplits(data.amount, customSplits)) {
      return  // SplitEditor shows the inline error
    }

    try {
      await createExpense.mutateAsync({
        title:     data.title,
        amount:    Number(data.amount),
        paidBy,
        groupId:   groupId || null,
        tripId:    null,
        category:  data.category || null,
        date:      data.date,
        notes:     data.notes || null,
        splitType: splitType === 'custom' ? 'custom' : 'equal',
        splits:    activeSplits.map(s => ({
          profile_id: s.profile_id,
          amount:     Number(s.amount),
        })),
      })
      navigate(-1)
    } catch {
      // toast handled by hook
    }
  }

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Nav */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-indigo-600 font-medium"
        >
          Cancel
        </button>
        <h1 className="text-base font-semibold text-gray-900">Add Expense</h1>
        <button
          form="expense-form"
          type="submit"
          disabled={createExpense.isPending}
          className="text-sm font-medium text-indigo-600 disabled:opacity-50"
        >
          {createExpense.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <form id="expense-form" onSubmit={handleSubmit(onSubmit)}>
          {/* Title + Amount */}
          <div className="px-4 pt-4 space-y-4">
            <div>
              <input
                {...register('title')}
                placeholder="What was this for?"
                className="w-full text-lg font-medium placeholder-gray-300 outline-none border-b border-gray-200 pb-2 focus:border-indigo-500"
              />
              {errors.title && (
                <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xl text-gray-400 font-light">₹</span>
              <input
                {...register('amount')}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                className="flex-1 text-2xl font-semibold placeholder-gray-300 outline-none border-b border-gray-200 pb-1 focus:border-indigo-500"
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Category + Date */}
          <div className="px-4 pt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Category</label>
              <select
                {...register('category')}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="">Select…</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Date</label>
              <input
                {...register('date')}
                type="date"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="px-4 pt-3">
            <input
              {...register('notes')}
              placeholder="Notes (optional)"
              className="w-full text-sm placeholder-gray-300 outline-none border-b border-gray-100 pb-2 focus:border-indigo-400"
            />
          </div>

          {/* Participants */}
          <Section title="Split between">
            <ParticipantPicker
              candidates={candidates}
              selected={selectedIds}
              lockedIds={new Set([userId])}
              onChange={next => {
                setSelectedIds(next)
                if (splitType === 'custom') {
                  setCustomSplits(computeEqualSplit(amount, [...next], paidBy))
                }
              }}
            />
          </Section>

          {/* Paid by */}
          <Section title="Paid by">
            <PaidByPicker
              participants={participants}
              value={paidBy}
              onChange={id => {
                setPaidBy(id)
                if (splitType === 'equal') {
                  // equal splits recalculate automatically via memo
                } else {
                  setCustomSplits(computeEqualSplit(amount, participants.map(p => p.id), id))
                }
              }}
            />
          </Section>

          {/* Split type toggle */}
          <Section title="Split type">
            <div className="px-4 pb-2">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {[
                  { value: 'equal', label: 'Equal' },
                  { value: 'custom', label: 'Exact amounts' },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex-1 py-2 text-sm text-center cursor-pointer transition-colors ${
                      splitType === opt.value
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      {...register('split_type')}
                      type="radio"
                      value={opt.value}
                      className="sr-only"
                      onChange={e => {
                        register('split_type').onChange(e)
                        handleSplitTypeChange(e)
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </Section>

          {/* Split preview/editor */}
          {participants.length > 0 && amount && (
            <Section title="Breakdown">
              <SplitEditor
                splitType={splitType}
                participants={participants}
                splits={activeSplits}
                totalAmount={amount}
                onChange={setCustomSplits}
              />
            </Section>
          )}
        </form>
      )}
    </div>
  )
}
