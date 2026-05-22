import { useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth.js'
import { useFriends } from '../../hooks/useFriends.js'
import { useGroupMembers } from '../../hooks/useGroups.js'
import { useTripMembers, useTrip } from '../../hooks/useTrips.js'
import { useCreateExpense } from '../../hooks/useExpenses.js'
import { useAiUsageCount } from '../../hooks/useAiUsage.js'
import { ocr, parseSplit } from '../../lib/ai-client.js'
import { uploadDraftReceipt } from '../../lib-web/receipts.js'
import { CATEGORIES, CATEGORY_LABELS } from '../../lib/schemas/expenses.js'
import { formatINR } from '../../lib/money.js'
import MicButton from '../../components/MicButton.jsx'
import ItemAssignChips from '../../components/ItemAssignChips.jsx'
import AiUsageBadge from '../../components/AiUsageBadge.jsx'

// ── helpers ─────────────────────────────────────────────────────────────────

function buildMergedDescription(textInput, tapAssignments, items, participants) {
  const lines = []
  for (const [idx, ids] of Object.entries(tapAssignments)) {
    if (!ids.size) continue
    const names = [...ids]
      .map(id => participants.find(p => p.id === id)?.name)
      .filter(Boolean)
    lines.push(`${names.join(' and ')} had the ${items[idx]?.name}`)
  }
  return [lines.join(', '), textInput].filter(Boolean).join('. ')
}

// ── sub-stage components ─────────────────────────────────────────────────────

function ScanStage({ onUploaded, isAtLimit }) {
  const fileRef  = useRef(null)
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const path = await uploadDraftReceipt(file, user.id)
      onUploaded(path)
    } catch {
      toast.error("Couldn't upload photo — check your connection")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center">
        <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-900">Scan a receipt</p>
        <p className="text-sm text-gray-400 mt-1">Works with restaurant bills, Swiggy/Zomato screenshots, and handwritten chits</p>
      </div>
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || isAtLimit}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Uploading…
            </span>
          ) : 'Choose photo'}
        </button>
        {isAtLimit && (
          <p className="text-xs text-red-500 text-center">Daily AI limit reached. Try again tomorrow or use manual entry.</p>
        )}
        <p className="text-xs text-gray-300 text-center">Receipt photos are auto-deleted after 30 days.</p>
        <AiUsageBadge />
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

function ReviewItemsStage({ items, taxAmount, onItemsChange, onRetry, onNext, isAtLimit }) {
  function updateItem(idx, field, value) {
    const next = items.map((it, i) => i === idx ? { ...it, [field]: value } : it)
    onItemsChange(next)
  }

  function removeItem(idx) {
    onItemsChange(items.filter((_, i) => i !== idx))
  }

  function addItem() {
    onItemsChange([...items, { name: '', price: 0, quantity: 1 }])
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-base font-semibold text-gray-800">Couldn't read this receipt</p>
        <p className="text-sm text-gray-400">Try a clearer photo or enter the expense manually.</p>
        <button onClick={onRetry} disabled={isAtLimit}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
          Try a clearer photo
        </button>
        <button onClick={() => window.history.back()}
          className="text-sm text-gray-400 underline">
          Switch to manual entry
        </button>
        <AiUsageBadge />
      </div>
    )
  }

  return (
    <div>
      <p className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
        Review extracted items
      </p>
      <div className="divide-y divide-gray-50">
        {items.map((item, idx) => (
          <div key={idx} className="px-4 py-3 flex items-center gap-2">
            <input
              value={item.name}
              onChange={e => updateItem(idx, 'name', e.target.value)}
              placeholder="Item name"
              className="flex-1 text-sm text-gray-900 border-b border-gray-200 focus:border-indigo-500 outline-none pb-0.5 bg-transparent"
            />
            <span className="text-sm text-gray-400">₹</span>
            <input
              type="number"
              value={item.price}
              onChange={e => updateItem(idx, 'price', parseFloat(e.target.value) || 0)}
              className="w-20 text-sm text-right text-gray-900 border-b border-gray-200 focus:border-indigo-500 outline-none pb-0.5 bg-transparent"
            />
            <button onClick={() => removeItem(idx)}
              className="text-gray-300 hover:text-red-500 p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {taxAmount > 0 && (
        <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
          Tax/charges: ₹{taxAmount.toFixed(0)} (will be split proportionally)
        </p>
      )}
      <div className="px-4 py-2 border-t border-gray-50">
        <button onClick={addItem}
          className="text-sm text-indigo-600 font-medium">
          + Add item
        </button>
      </div>
      <div className="px-4 pb-4 flex gap-3">
        <button onClick={onRetry} disabled={isAtLimit}
          className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm disabled:opacity-40">
          Try a clearer photo
        </button>
        <button onClick={onNext} disabled={items.every(it => !it.name)}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
          Next →
        </button>
      </div>
    </div>
  )
}

function DescribeSplitStage({ items, participants, onProcess }) {
  const [text,           setText]           = useState('')
  const [tapAssignments, setTapAssignments] = useState({})

  function handleTapChange(itemIdx, profileId, assigned) {
    setTapAssignments(prev => {
      const next = { ...prev }
      const set  = new Set(prev[itemIdx] ?? [])
      assigned ? set.add(profileId) : set.delete(profileId)
      next[itemIdx] = set
      return next
    })
  }

  function handleProcess() {
    const merged = buildMergedDescription(text, tapAssignments, items, participants)
    onProcess(merged)
  }

  const hasInput = text.trim() || Object.values(tapAssignments).some(s => s.size > 0)

  return (
    <div className="px-4 pb-4 space-y-4">
      <p className="pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Describe the split
      </p>
      <div className="flex items-start gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'e.g. "Yasir had lime soda, Sahid and Adnan split the dosa"'}
          rows={3}
          className="flex-1 text-sm text-gray-900 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 resize-none"
        />
        <MicButton onTranscript={t => setText(prev => [prev, t].filter(Boolean).join(' '))} />
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">Or tap to assign items directly:</p>
        <ItemAssignChips
          items={items}
          participants={participants}
          assignments={tapAssignments}
          onChange={handleTapChange}
        />
      </div>

      <button
        onClick={handleProcess}
        disabled={!hasInput}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40"
      >
        Work out the split
      </button>
    </div>
  )
}

function ProcessingStage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24">
      <div className="w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Working out the math…</p>
    </div>
  )
}

function ReviewSplitStage({ splits, unattributed, participants, items, onReDescribe, onConfirm }) {
  const [localUnattributed, setLocalUnattributed] = useState(unattributed ?? [])
  const [localAssign, setLocalAssign] = useState({})
  const [localSplits, setLocalSplits] = useState(splits ?? [])

  function assignUnattributed(itemIdx, profileId, assigned) {
    setLocalAssign(prev => {
      const next = { ...prev }
      const set  = new Set(prev[itemIdx] ?? [])
      assigned ? set.add(profileId) : set.delete(profileId)
      next[itemIdx] = set
      return next
    })
  }

  function handleConfirm() {
    // Merge unattributed items that have been assigned
    const mergedSplits = [...localSplits]
    localUnattributed.forEach((item, idx) => {
      const assignedIds = [...(localAssign[idx] ?? [])]
      if (!assignedIds.length) return
      const shareEach = item.price / assignedIds.length
      assignedIds.forEach(pid => {
        const existing = mergedSplits.find(s => s.profile_id === pid)
        if (existing) {
          existing.total     = (existing.total     ?? 0) + shareEach
          existing.subtotal  = (existing.subtotal  ?? 0) + shareEach
        } else {
          const p = participants.find(p => p.id === pid)
          mergedSplits.push({ profile_id: pid, name: p?.name ?? '', subtotal: shareEach, tax_share: 0, total: shareEach, items: [] })
        }
      })
    })
    onConfirm(mergedSplits)
  }

  const stillUnattributed = localUnattributed.filter((_, idx) => !(localAssign[idx]?.size > 0))

  return (
    <div className="pb-4">
      <p className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
        Per-person breakdown
      </p>
      <div className="divide-y divide-gray-50">
        {localSplits.map((s, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-gray-900">{s.name}</p>
              <p className="text-sm font-semibold text-gray-900">{formatINR(s.total)}</p>
            </div>
            {s.items?.map((it, j) => (
              <p key={j} className="text-xs text-gray-400 mt-0.5 pl-2">
                {it.item_name} ({Math.round(it.fraction * 100)}%) — {formatINR(it.amount)}
              </p>
            ))}
            {s.tax_share > 0 && (
              <p className="text-xs text-gray-300 pl-2">Tax share: {formatINR(s.tax_share)}</p>
            )}
          </div>
        ))}
      </div>

      {localUnattributed.length > 0 && (
        <div className="px-4 pt-3">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
            Unattributed — tap to assign
          </p>
          <ItemAssignChips
            items={localUnattributed}
            participants={participants}
            assignments={localAssign}
            onChange={assignUnattributed}
          />
        </div>
      )}

      <div className="px-4 pt-4 flex gap-3">
        <button onClick={onReDescribe}
          className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">
          Re-describe
        </button>
        <button
          onClick={handleConfirm}
          disabled={stillUnattributed.length > 0}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {stillUnattributed.length > 0
            ? `${stillUnattributed.length} unassigned`
            : 'Looks good →'}
        </button>
      </div>
    </div>
  )
}

function ConfirmStage({ splits, items, contextLabel, category, onCategoryChange, onSave, isSaving }) {
  const total = splits.reduce((s, p) => s + (p.total ?? 0), 0)

  return (
    <div className="px-4 pb-4 space-y-4">
      <p className="pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Ready to save
      </p>
      <div className="bg-gray-50 rounded-xl p-4 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total</span>
          <span className="font-semibold text-gray-900">{formatINR(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Context</span>
          <span className="text-gray-700">{contextLabel}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Split among</span>
          <span className="text-gray-700">{splits.length} people</span>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Category (optional)</p>
        <select
          value={category}
          onChange={e => onCategoryChange(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 bg-white"
        >
          <option value="">None</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm disabled:opacity-40"
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving…
          </span>
        ) : 'Save expense'}
      </button>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AiReceiptScan() {
  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const groupId       = params.get('groupId')
  const tripId        = params.get('tripId')
  const friendId      = params.get('friendId')
  const { user }      = useAuth()
  const userId        = user?.id
  const queryClient   = useQueryClient()
  const createExpense = useCreateExpense()
  const { isAtLimit } = useAiUsageCount()

  const { members: groupMembers } = useGroupMembers(groupId)
  const { members: tripMembers  } = useTripMembers(tripId)
  const { trip }                  = useTrip(tripId)
  const { friends }               = useFriends()

  const participants = useMemo(() => {
    const self = { id: userId, name: user?.user_metadata?.name || 'You', avatar_url: null }
    if (tripId) {
      return tripMembers
        .filter(m => !m.deleted_at)
        .map(m => ({ id: m.profile_id, name: m.profile?.name, avatar_url: m.profile?.avatar_url }))
    }
    if (groupId) {
      return groupMembers
        .filter(m => !m.deleted_at)
        .map(m => ({ id: m.profile_id, name: m.profile?.name, avatar_url: m.profile?.avatar_url }))
    }
    if (friendId) {
      const fr = friends.find(f => f.friend.id === friendId)
      return fr
        ? [self, { id: fr.friend.id, name: fr.friend.name, avatar_url: fr.friend.avatar_url }]
        : [self]
    }
    return [self]
  }, [userId, user, tripId, groupId, friendId, tripMembers, groupMembers, friends])

  const contextLabel = tripId
    ? (trip?.name ?? 'Trip')
    : groupId
      ? (groupMembers[0]?.group?.name ?? 'Group')
      : friendId
        ? (friends.find(f => f.friend.id === friendId)?.friend?.name ?? 'Friend')
        : 'Direct'

  // Stage state machine
  const [stage,          setStage]          = useState('scan')
  const [draftPath,      setDraftPath]      = useState(null)
  const [items,          setItems]          = useState([])
  const [taxAmount,      setTaxAmount]      = useState(0)
  const [finalSplits,    setFinalSplits]    = useState([])
  const [unattributed,   setUnattributed]   = useState([])
  const [category,       setCategory]       = useState('')

  const STAGE_TITLES = {
    'scan':          'Scan Receipt',
    'review-items':  'Review Items',
    'describe':      'Describe Split',
    'processing':    'Processing…',
    'review-split':  'Review Split',
    'confirm':       'Save Expense',
  }

  // Stage 1: upload done
  async function handleUploaded(path) {
    setDraftPath(path)
    setStage('processing')
    try {
      const result = await ocr(path)
      if (result._usage?.warn) {
        toast(`${result._usage.count} of ${result._usage.limit} AI requests used today`, { icon: '⚠️' })
      }
      setItems(result.items ?? [])
      setTaxAmount(result.tax_amount ?? 0)
      setStage('review-items')
    } catch (err) {
      if (err.status === 429) {
        toast.error(err.message ?? 'Daily AI limit reached')
        setStage('scan')
      } else {
        toast.error("Couldn't read receipt. Try a clearer photo.")
        setItems([])
        setStage('review-items')
      }
    }
  }

  // Stage 3 → 4 → 5
  async function handleProcess(mergedDescription) {
    setStage('processing')
    try {
      const result = await parseSplit({
        items,
        description: mergedDescription,
        participants,
      })
      if (result._usage?.warn) {
        toast(`${result._usage.count} of ${result._usage.limit} AI requests used today`, { icon: '⚠️' })
      }
      setFinalSplits(result.splits ?? [])
      setUnattributed(result.unattributed ?? [])
      setStage('review-split')
    } catch (err) {
      if (err.status === 429) {
        toast.error(err.message ?? 'Daily AI limit reached')
        setStage('describe')
      } else {
        toast.error("Couldn't work out the split. Try re-describing.")
        setStage('describe')
      }
    }
  }

  // Stage 6: save
  async function handleSave(confirmedSplits) {
    const total    = confirmedSplits.reduce((s, p) => s + (p.total ?? 0), 0)
    const paidById = confirmedSplits.reduce((a, b) => (a.total ?? 0) >= (b.total ?? 0) ? a : b).profile_id
    const splits   = confirmedSplits.map(s => ({
      profile_id: s.profile_id,
      amount:     parseFloat(s.total.toFixed(2)),
    }))

    try {
      await createExpense.mutateAsync({
        title:       'Receipt split',
        amount:      parseFloat(total.toFixed(2)),
        paidBy:      paidById,
        groupId:     groupId || null,
        tripId:      tripId || null,
        category:    category || null,
        date:        new Date().toISOString().split('T')[0],
        notes:       null,
        splitType:   'item',
        splits,
        aiParsed:    true,
        receiptPath: draftPath,
      })

      // Daily budget warning for trips
      if (tripId && trip?.daily_budget) {
        const today    = new Date().toISOString().split('T')[0]
        const cached   = queryClient.getQueryData(['trip-expenses', tripId]) ?? []
        const dayTotal = [...cached].filter(e => e.date === today).reduce((s, e) => s + +e.amount, 0) + total
        if (dayTotal > trip.daily_budget) {
          toast(`Day's spend ${formatINR(dayTotal)} exceeds your ${formatINR(trip.daily_budget)} daily budget`, { icon: '⚠️' })
        }
      }

      if (tripId)        navigate(`/trips/${tripId}`)
      else if (groupId)  navigate(`/groups/${groupId}`)
      else if (friendId) navigate(`/friends/${friendId}`)
      else               navigate('/')
    } catch {
      // createExpense hook handles the error toast
    }
  }

  function handleBack() {
    const prev = { 'review-items': 'scan', 'describe': 'review-items', 'review-split': 'describe', 'confirm': 'review-split' }
    if (stage === 'scan') navigate(-1)
    else if (prev[stage]) setStage(prev[stage])
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center z-10">
        <button onClick={handleBack} className="text-sm text-indigo-600 font-medium mr-auto">
          ← {stage === 'scan' ? 'Cancel' : 'Back'}
        </button>
        <h1 className="text-base font-semibold text-gray-900 absolute left-1/2 -translate-x-1/2">
          {STAGE_TITLES[stage]}
        </h1>
        {stage !== 'processing' && stage !== 'scan' && (
          <div className="ml-auto">
            <AiUsageBadge />
          </div>
        )}
      </div>

      {stage === 'scan' && (
        <ScanStage onUploaded={handleUploaded} isAtLimit={isAtLimit} />
      )}
      {stage === 'review-items' && (
        <ReviewItemsStage
          items={items}
          taxAmount={taxAmount}
          onItemsChange={setItems}
          onRetry={() => setStage('scan')}
          onNext={() => setStage('describe')}
          isAtLimit={isAtLimit}
        />
      )}
      {stage === 'describe' && (
        <DescribeSplitStage
          items={items}
          participants={participants}
          onProcess={handleProcess}
        />
      )}
      {stage === 'processing' && <ProcessingStage />}
      {stage === 'review-split' && (
        <ReviewSplitStage
          splits={finalSplits}
          unattributed={unattributed}
          participants={participants}
          items={items}
          onReDescribe={() => setStage('describe')}
          onConfirm={splits => { setFinalSplits(splits); setStage('confirm') }}
        />
      )}
      {stage === 'confirm' && (
        <ConfirmStage
          splits={finalSplits}
          items={items}
          contextLabel={contextLabel}
          category={category}
          onCategoryChange={setCategory}
          onSave={() => handleSave(finalSplits)}
          isSaving={createExpense.isPending}
        />
      )}
    </div>
  )
}
