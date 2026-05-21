import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateTrip } from '../../hooks/useTrips.js'
import { useFriends } from '../../hooks/useFriends.js'
import { addTripMember } from '../../lib/trips.js'

export default function CreateTrip() {
  const navigate    = useNavigate()
  const createTrip  = useCreateTrip()
  const { friends } = useFriends()

  const [name,         setName]         = useState('')
  const [destination,  setDestination]  = useState('')
  const [startDate,    setStartDate]    = useState(new Date().toISOString().split('T')[0])
  const [endDate,      setEndDate]      = useState(new Date().toISOString().split('T')[0])
  const [hasBudget,    setHasBudget]    = useState(false)
  const [budget,       setBudget]       = useState('')
  const [hasDailyBudget, setHasDailyBudget] = useState(false)
  const [dailyBudget,  setDailyBudget]  = useState('')
  const [selectedFriends, setSelectedFriends] = useState(new Set())
  const [errors,       setErrors]       = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function toggleFriend(id) {
    setSelectedFriends(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function validate() {
    const errs = {}
    if (!name.trim())            errs.name      = 'Trip name is required'
    if (!startDate)              errs.startDate = 'Start date is required'
    if (!endDate)                errs.endDate   = 'End date is required'
    if (endDate < startDate)     errs.endDate   = 'End date must be on or after start date'
    if (hasBudget && !budget)    errs.budget    = 'Enter a budget amount'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setIsSubmitting(true)
    try {
      const tripId = await createTrip.mutateAsync({
        name,
        destination,
        startDate,
        endDate,
        budget:       hasBudget ? budget : null,
        dailyBudget:  hasBudget && hasDailyBudget ? dailyBudget : null,
      })
      // Add selected friends sequentially (small N, order matters for UX)
      for (const profileId of selectedFriends) {
        try {
          await addTripMember(tripId, profileId)
        } catch {
          // Non-fatal — user can add from Members tab
        }
      }
      navigate(`/trips/${tripId}`, { replace: true })
    } catch {
      // toast handled by hook
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">Cancel</button>
        <h1 className="flex-1 text-base font-semibold text-gray-900 text-center">New trip</h1>
        <div className="w-14" />
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Trip name
          </label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Goa 2026, Manali Winter..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        {/* Destination */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Destination <span className="text-gray-400 normal-case font-normal">(optional)</span>
          </label>
          <input
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Goa 🌊, Manali ❄️..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-indigo-400"
            />
            {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-indigo-400"
            />
            {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate}</p>}
          </div>
        </div>

        {/* Budget toggle */}
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-gray-700">Set total budget</span>
            <div
              onClick={() => { setHasBudget(v => !v); if (hasBudget) setHasDailyBudget(false) }}
              className={`w-10 h-6 rounded-full transition-colors ${hasBudget ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <div className={`w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow transition-transform ${hasBudget ? 'translate-x-4' : ''}`} />
            </div>
          </label>

          {hasBudget && (
            <div>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-gray-400 font-light text-lg">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  placeholder="0"
                  className="flex-1 text-sm outline-none"
                />
              </div>
              {errors.budget && <p className="text-xs text-red-500 mt-1">{errors.budget}</p>}
            </div>
          )}

          {hasBudget && (
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-gray-700">Set daily budget</span>
              <div
                onClick={() => setHasDailyBudget(v => !v)}
                className={`w-10 h-6 rounded-full transition-colors ${hasDailyBudget ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <div className={`w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow transition-transform ${hasDailyBudget ? 'translate-x-4' : ''}`} />
              </div>
            </label>
          )}

          {hasBudget && hasDailyBudget && (
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-gray-400 font-light text-lg">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={dailyBudget}
                onChange={e => setDailyBudget(e.target.value)}
                placeholder="0 per day"
                className="flex-1 text-sm outline-none"
              />
            </div>
          )}
        </div>

        {/* Members */}
        {friends.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Add members <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <ul className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {friends.map(f => (
                <li key={f.friend.id}>
                  <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedFriends.has(f.friend.id)}
                      onChange={() => toggleFriend(f.friend.id)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 accent-indigo-600"
                    />
                    <span className="text-sm text-gray-800">{f.friend.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {isSubmitting ? 'Creating…' : 'Create trip'}
        </button>
      </form>
    </div>
  )
}
