import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrip } from '../../hooks/useTrips.js'
import { useTripMembers } from '../../hooks/useTrips.js'
import { useAuth } from '../../hooks/useAuth.js'

export default function EditTrip() {
  const { tripId }  = useParams()
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const { trip, isLoading, updateTrip } = useTrip(tripId)
  const { isAdmin }  = useTripMembers(tripId)

  const [name,         setName]         = useState('')
  const [destination,  setDestination]  = useState('')
  const [startDate,    setStartDate]    = useState('')
  const [endDate,      setEndDate]      = useState('')
  const [hasBudget,    setHasBudget]    = useState(false)
  const [budget,       setBudget]       = useState('')
  const [hasDailyBudget, setHasDailyBudget] = useState(false)
  const [dailyBudget,  setDailyBudget]  = useState('')
  const [errors,       setErrors]       = useState({})
  const [seeded,       setSeeded]       = useState(false)

  // Seed form from loaded trip
  useEffect(() => {
    if (trip && !seeded) {
      setName(trip.name || '')
      setDestination(trip.destination || '')
      setStartDate(trip.start_date || '')
      setEndDate(trip.end_date || '')
      setHasBudget(!!trip.budget)
      setBudget(trip.budget ? String(trip.budget) : '')
      setHasDailyBudget(!!trip.daily_budget)
      setDailyBudget(trip.daily_budget ? String(trip.daily_budget) : '')
      setSeeded(true)
    }
  }, [trip, seeded])

  // Redirect non-admins
  useEffect(() => {
    if (!isLoading && trip && !isAdmin) navigate(`/trips/${tripId}`, { replace: true })
  }, [isAdmin, isLoading, trip, tripId, navigate])

  function validate() {
    const errs = {}
    if (!name.trim())        errs.name    = 'Trip name is required'
    if (endDate < startDate) errs.endDate = 'End date must be on or after start date'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    try {
      await updateTrip.mutateAsync({
        name,
        destination,
        startDate,
        endDate,
        budget:      hasBudget ? budget : null,
        dailyBudget: hasBudget && hasDailyBudget ? dailyBudget : null,
      })
      navigate(`/trips/${tripId}`)
    } catch {}
  }

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">Cancel</button>
        <h1 className="flex-1 text-base font-semibold text-gray-900 text-center">Edit trip</h1>
        <div className="w-14" />
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Trip name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Destination <span className="text-gray-400 normal-case font-normal">(optional)</span>
          </label>
          <input
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Goa 🌊..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">End date</label>
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

        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-gray-700">Total budget</span>
            <div
              onClick={() => { setHasBudget(v => !v); if (hasBudget) setHasDailyBudget(false) }}
              className={`w-10 h-6 rounded-full transition-colors ${hasBudget ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <div className={`w-5 h-5 mt-0.5 mx-0.5 bg-white rounded-full shadow transition-transform ${hasBudget ? 'translate-x-4' : ''}`} />
            </div>
          </label>

          {hasBudget && (
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
          )}

          {hasBudget && (
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-gray-700">Daily budget</span>
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

        <button
          type="submit"
          disabled={updateTrip.isPending || !name.trim()}
          className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {updateTrip.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
