import { supabase } from './supabase.js'

const MEMBER_SELECT = `
  id, trip_id, profile_id, role, joined_at,
  profile:profiles!profile_id(id, name, avatar_url)
`

const EXPENSE_SELECT = `
  id, title, amount, paid_by, trip_id, category,
  date, notes, split_type, deleted_at, created_at, updated_at,
  payer:profiles!paid_by(id, name, avatar_url),
  splits:expense_splits(id, profile_id, amount, deleted_at,
    profile:profiles!profile_id(id, name, avatar_url))
`

export async function createTrip({ name, destination, startDate, endDate, budget, dailyBudget }) {
  const { data, error } = await supabase.rpc('create_trip', {
    p_name:         name.trim(),
    p_destination:  destination?.trim() || null,
    p_start_date:   startDate,
    p_end_date:     endDate,
    p_budget:       budget ? Number(budget) : null,
    p_daily_budget: dailyBudget ? Number(dailyBudget) : null,
  })
  if (error) {
    if (error.message?.includes('INVALID_DATES')) throw new Error('INVALID_DATES')
    throw error
  }
  return data  // uuid
}

export async function getTrip(tripId) {
  const { data: trip, error } = await supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, budget, daily_budget, archived_at, created_by, created_at, updated_at')
    .eq('id', tripId)
    .is('deleted_at', null)
    .single()
  if (error) throw error

  const { count } = await supabase
    .from('trip_members')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .is('deleted_at', null)

  return { ...trip, memberCount: count ?? 0 }
}

export async function updateTrip(tripId, patch) {
  const update = {}
  if (patch.name        !== undefined) update.name         = patch.name.trim()
  if (patch.destination !== undefined) update.destination  = patch.destination?.trim() || null
  if (patch.startDate   !== undefined) update.start_date   = patch.startDate
  if (patch.endDate     !== undefined) update.end_date     = patch.endDate
  if (patch.budget      !== undefined) update.budget       = patch.budget ? Number(patch.budget) : null
  if (patch.dailyBudget !== undefined) update.daily_budget = patch.dailyBudget ? Number(patch.dailyBudget) : null
  const { error } = await supabase.from('trips').update(update).eq('id', tripId)
  if (error) throw error
}

export async function archiveTrip(tripId) {
  const { error } = await supabase
    .from('trips')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', tripId)
  if (error) throw error
}

export async function listMyTrips(userId, { archived = false } = {}) {
  let query = supabase
    .from('trips')
    .select('id, name, destination, start_date, end_date, budget, daily_budget, archived_at, updated_at, created_by')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  query = archived
    ? query.not('archived_at', 'is', null)
    : query.is('archived_at', null)

  const { data: trips, error } = await query
  if (error) throw error
  if (!trips || trips.length === 0) return []

  const tripIds = trips.map(t => t.id)
  const { data: memberships, error: mErr } = await supabase
    .from('trip_members')
    .select('trip_id, profile_id, role')
    .in('trip_id', tripIds)
    .is('deleted_at', null)
  if (mErr) throw mErr

  const countMap = {}
  const roleMap  = {}
  for (const row of memberships) {
    countMap[row.trip_id] = (countMap[row.trip_id] || 0) + 1
    if (row.profile_id === userId) roleMap[row.trip_id] = row.role
  }

  return trips
    .filter(t => roleMap[t.id])  // only trips the caller is a member of
    .map(t => ({
      ...t,
      memberCount: countMap[t.id] || 0,
      callerRole:  roleMap[t.id] || null,
    }))
}

export async function listTripMembers(tripId) {
  const { data, error } = await supabase
    .from('trip_members')
    .select(MEMBER_SELECT)
    .eq('trip_id', tripId)
    .is('deleted_at', null)
  if (error) throw error

  return (data || []).sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
    return (a.profile?.name || '').localeCompare(b.profile?.name || '')
  })
}

export async function addTripMember(tripId, profileId) {
  const { error } = await supabase.rpc('add_trip_member', {
    p_trip_id:    tripId,
    p_profile_id: profileId,
  })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('NOT_ADMIN'))      throw new Error('NOT_ADMIN')
    if (msg.includes('ALREADY_MEMBER')) throw new Error('ALREADY_MEMBER')
    throw error
  }
}

export async function removeTripMember(tripId, profileId) {
  const { error } = await supabase
    .from('trip_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
  if (error) throw error
}

export async function setTripMemberRole(tripId, profileId, role) {
  const { error } = await supabase.rpc('set_trip_member_role', {
    p_trip_id:    tripId,
    p_profile_id: profileId,
    p_role:       role,
  })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('LAST_ADMIN')) throw new Error('LAST_ADMIN')
    if (msg.includes('NOT_ADMIN'))  throw new Error('NOT_ADMIN')
    throw error
  }
}

export async function leaveTrip(tripId) {
  const { error } = await supabase.rpc('leave_trip', { p_trip_id: tripId })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('LAST_ADMIN'))  throw new Error('LAST_ADMIN')
    if (msg.includes('NOT_A_MEMBER')) throw new Error('NOT_A_MEMBER')
    throw error
  }
}

export async function listTripExpenses(tripId) {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(e => ({
    ...e,
    splits: (e.splits || []).filter(s => !s.deleted_at),
  }))
}

export async function getTripBalances(tripId) {
  const { data, error } = await supabase.rpc('get_trip_balances', { p_trip_id: tripId })
  if (error) throw error
  return data || []
}

export async function getTripSummary(tripId) {
  const { data, error } = await supabase.rpc('get_trip_summary', { p_trip_id: tripId })
  if (error) throw error
  return data
}

export async function getTripPersonalInsights(tripId) {
  const { data, error } = await supabase.rpc('get_trip_personal_insights', { p_trip_id: tripId })
  if (error) throw error
  return data || []
}

const FUN_FACTS = {
  food:          'Always picking up the food tab',
  transport:     'The designated ride-booker',
  accommodation: 'Lives for the suite life',
  entertainment: 'First to suggest an adventure',
  groceries:     'The responsible grocery runner',
  shopping:      'Retail therapy enthusiast',
  other:         'The wildcard of the group',
}

export function computeTripInsights(rawInsights) {
  const badges = {}
  const init   = (id) => { if (!badges[id]) badges[id] = [] }

  const maxPaid = Math.max(...rawInsights.map(r => r.expenses_paid_count))
  if (maxPaid > 0) {
    const winner = rawInsights.find(r => r.expenses_paid_count === maxPaid)
    init(winner.profile_id)
    badges[winner.profile_id].push({ emoji: '💳', label: 'Paid for the most' })
  }

  const maxShare = Math.max(...rawInsights.map(r => r.own_share))
  if (maxShare > 0) {
    const winner = rawInsights.find(r => r.own_share === maxShare)
    init(winner.profile_id)
    badges[winner.profile_id].push({ emoji: '💰', label: 'Biggest spender' })
  }

  const generosity = rawInsights
    .map(r => ({ ...r, ratio: r.own_share > 0 ? (r.total_paid - r.own_share) / r.own_share : 0 }))
    .filter(r => r.ratio > 0)
  if (generosity.length > 0) {
    const winner = generosity.reduce((a, b) => a.ratio > b.ratio ? a : b)
    init(winner.profile_id)
    badges[winner.profile_id].push({ emoji: '🎯', label: 'Most generous' })
  }

  const settlers = rawInsights.filter(r => r.avg_settle_secs != null)
  if (settlers.length > 0) {
    const winner = settlers.reduce((a, b) => a.avg_settle_secs < b.avg_settle_secs ? a : b)
    init(winner.profile_id)
    badges[winner.profile_id].push({ emoji: '⚡', label: 'Settled fastest' })
  }

  return rawInsights.map(r => ({
    ...r,
    badges:   badges[r.profile_id] ?? [],
    fun_fact: FUN_FACTS[r.top_category] ?? FUN_FACTS.other,
  }))
}
