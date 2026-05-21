import { useMemo, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTripSummary, useTripInsights, useTripMembers } from '../../hooks/useTrips.js'
import { computeTripTag } from '../../lib/trip-tag.js'
import { buildRecapCardSVG } from '../../lib/recap-card.js'
import { getAvatarColor, generateInitials } from '../../lib/avatar.js'
import { svgToPng } from '../../lib-web/svg-to-png.js'
import { formatINR } from '../../lib/money.js'
import Avatar from '../../components/Avatar.jsx'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function formatDateRange(s, e) {
  const start = new Date(s + 'T00:00:00')
  const end   = new Date(e + 'T00:00:00')
  return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

async function shareCard(svgString, tripName) {
  try {
    const blob = await svgToPng(svgString)
    const file = new File([blob], `${tripName}-recap.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `${tripName} Recap` })
    } else {
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${tripName}-recap.png`
      a.click()
      URL.revokeObjectURL(url)
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.error('Share failed', err)
  }
}

export default function TripRecap() {
  const { tripId } = useParams()
  const navigate   = useNavigate()
  const { summary,  isLoading: summaryLoading  } = useTripSummary(tripId)
  const { insights, isLoading: insightsLoading } = useTripInsights(tripId)
  const { members } = useTripMembers(tripId)

  if (summaryLoading || insightsLoading) return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
      </div>
      <Spinner />
    </div>
  )

  if (!summary) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-sm text-gray-400">Trip not found</p>
    </div>
  )

  const today = new Date().toISOString().split('T')[0]
  if (summary.trip.end_date >= today) return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
      </div>
      <div className="px-4 py-12 text-center">
        <p className="text-lg font-semibold text-gray-700">Trip is still in progress</p>
        <p className="text-sm text-gray-400 mt-2">Come back after {summary.trip.end_date} to share the recap</p>
      </div>
    </div>
  )

  return <RecapContent summary={summary} insights={insights} members={members} navigate={navigate} />
}

function RecapContent({ summary, insights, members, navigate }) {
  const catMap = {}
  for (const cat of summary.top_categories || []) {
    catMap[cat.category] = Number(cat.amount)
  }

  const tag = computeTripTag({
    total:      Number(summary.total_spent),
    categories: catMap,
    members:    summary.member_count,
    days:       summary.days,
  })

  const memberInitials = members.slice(0, 6).map(m => ({
    initials: generateInitials(m.profile?.name),
    color:    getAvatarColor(m.profile_id),
  }))

  const svgString = useMemo(() => buildRecapCardSVG({
    tripName:      summary.trip.name,
    destination:   summary.trip.destination,
    dateRange:     formatDateRange(summary.trip.start_date, summary.trip.end_date),
    totalSpent:    Number(summary.total_spent),
    memberCount:   summary.member_count,
    memberInitials,
    topCategories: (summary.top_categories || []).map(c => ({
      category: c.category,
      amount:   Number(c.amount),
      pct:      Number(c.pct),
    })),
    tag,
  }), [summary, members])

  // Blob URL for safe SVG preview — created in effect so StrictMode remount gets a fresh URL
  const [previewUrl, setPreviewUrl] = useState('')
  useEffect(() => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [svgString])

  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium">← Back</button>
        <h1 className="text-base font-semibold text-gray-900">Trip Recap</h1>
        <button
          onClick={() => shareCard(svgString, summary.trip.name)}
          className="text-sm font-semibold text-indigo-600"
        >
          Share
        </button>
      </div>

      {/* Recap card preview */}
      <div className="px-4 py-4">
        <img
          src={previewUrl}
          alt={`${summary.trip.name} recap`}
          className="w-full rounded-2xl shadow-lg border border-gray-100"
          style={{ aspectRatio: '1' }}
        />
      </div>

      {/* In-app member insights */}
      {insights.length > 0 && (
        <div className="px-4 pt-2">
          <h2 className="text-base font-bold text-gray-900 mb-3">Member highlights</h2>
          <div className="space-y-4">
            {insights.map(ins => (
              <div key={ins.profile_id} className="flex gap-3 items-start">
                <Avatar
                  userId={ins.profile_id}
                  name={ins.name}
                  avatarUrl={ins.avatar_url}
                  size={44}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{ins.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ins.fun_fact}</p>
                  {ins.badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {ins.badges.map((b, i) => (
                        <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                          {b.emoji} {b.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Paid {formatINR(ins.total_paid)} · Share {formatINR(ins.own_share)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
