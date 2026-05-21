import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../hooks/useAuth.js'
import { useExpense, useUpdateExpense } from '../../hooks/useExpenses.js'
import { expenseFormSchema, CATEGORIES, CATEGORY_LABELS } from '../../lib/schemas/expenses.js'
import { computeEqualSplit, validateExactSplits } from '../../lib/split-math.js'
import PaidByPicker from '../../components/PaidByPicker.jsx'
import SplitEditor from '../../components/SplitEditor.jsx'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="border-t border-gray-100">
      <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

export default function EditExpense() {
  const { expenseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id

  const { expense, isLoading } = useExpense(expenseId)
  const updateExpense = useUpdateExpense(expenseId)

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(expenseFormSchema),
  })

  const [paidBy, setPaidBy] = useState(null)
  const [splits, setSplits] = useState([])
  const amount = watch('amount')
  const splitType = watch('split_type')

  useEffect(() => {
    if (expense) {
      reset({
        title:      expense.title,
        amount:     String(expense.amount),
        paid_by:    expense.paid_by,
        category:   expense.category || '',
        date:       expense.date,
        notes:      expense.notes || '',
        split_type: expense.split_type === 'item' ? 'equal' : expense.split_type,
      })
      setPaidBy(expense.paid_by)
      setSplits(expense.splits.map(s => ({ profile_id: s.profile_id, amount: s.amount })))
    }
  }, [expense, reset])

  const participants = useMemo(() => {
    if (!expense) return []
    return expense.splits.map(s => ({
      id: s.profile_id,
      name: s.profile?.name,
      avatar_url: s.profile?.avatar_url,
    }))
  }, [expense])

  const equalSplits = useMemo(
    () => computeEqualSplit(amount, participants.map(p => p.id), paidBy),
    [amount, participants, paidBy]
  )

  const activeSplits = splitType === 'equal' ? equalSplits : splits

  async function onSubmit(data) {
    if (splitType === 'custom' && !validateExactSplits(data.amount, splits)) return

    const patch = {}
    if (data.title !== expense.title)           patch.title    = data.title
    if (Number(data.amount) !== Number(expense.amount)) patch.amount = Number(data.amount)
    if (paidBy !== expense.paid_by)             patch.paid_by  = paidBy
    if ((data.category || null) !== expense.category) patch.category = data.category || null
    if (data.date !== expense.date)             patch.date     = data.date
    if ((data.notes || null) !== (expense.notes || null)) patch.notes = data.notes || null

    const splitsChanged = JSON.stringify(activeSplits) !== JSON.stringify(
      expense.splits.map(s => ({ profile_id: s.profile_id, amount: s.amount }))
    )

    try {
      await updateExpense.mutateAsync({
        patch,
        newSplits: splitsChanged ? activeSplits.map(s => ({
          profile_id: s.profile_id,
          amount: Number(s.amount),
        })) : null,
      })
      navigate(-1)
    } catch {
      // toast handled by hook
    }
  }

  if (isLoading) return <Spinner />
  if (!expense) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Expense not found.</p>
      </div>
    )
  }
  if (expense.created_by !== userId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <p className="text-sm text-gray-400 text-center">Only the creator can edit this expense.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">
          Cancel
        </button>
        <h1 className="text-base font-semibold text-gray-900">Edit Expense</h1>
        <button
          form="edit-expense-form"
          type="submit"
          disabled={updateExpense.isPending}
          className="text-sm font-medium text-indigo-600 disabled:opacity-50"
        >
          {updateExpense.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <form id="edit-expense-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="px-4 pt-4 space-y-4">
          <div>
            <input
              {...register('title')}
              placeholder="What was this for?"
              className="w-full text-lg font-medium placeholder-gray-300 outline-none border-b border-gray-200 pb-2 focus:border-indigo-500"
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
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
          {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
        </div>

        <div className="px-4 pt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Category</label>
            <select
              {...register('category')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
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

        <div className="px-4 pt-3">
          <input
            {...register('notes')}
            placeholder="Notes (optional)"
            className="w-full text-sm placeholder-gray-300 outline-none border-b border-gray-100 pb-2 focus:border-indigo-400"
          />
        </div>

        <Section title="Paid by">
          <PaidByPicker
            participants={participants}
            value={paidBy}
            onChange={id => {
              setPaidBy(id)
              if (splitType === 'custom') {
                setSplits(computeEqualSplit(amount, participants.map(p => p.id), id))
              }
            }}
          />
        </Section>

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
                      if (e.target.value === 'custom') {
                        setSplits(equalSplits)
                      }
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </Section>

        {participants.length > 0 && amount && (
          <Section title="Breakdown">
            <SplitEditor
              splitType={splitType}
              participants={participants}
              splits={activeSplits}
              totalAmount={amount}
              onChange={setSplits}
            />
          </Section>
        )}
      </form>
    </div>
  )
}
