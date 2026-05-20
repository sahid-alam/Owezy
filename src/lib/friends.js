import { supabase } from './supabase.js'
import { normalizePhone } from './phone-format.js'

const FRIEND_SELECT = `
  id, requester_id, addressee_id, status, created_at,
  requester:profiles!requester_id(id, name, avatar_url, upi_id, phone),
  addressee:profiles!addressee_id(id, name, avatar_url, upi_id, phone)
`

function otherParty(row, userId) {
  return row.requester_id === userId ? row.addressee : row.requester
}

// ── Lists ──────────────────────────────────────────────────────

export async function listFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIEND_SELECT)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted')
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? [])
    .map(f => ({ friendshipId: f.id, friend: otherParty(f, userId) }))
    .sort((a, b) => a.friend.name.localeCompare(b.friend.name))
}

export async function listIncomingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIEND_SELECT)
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(f => ({
    friendshipId: f.id,
    requester: f.requester,
    createdAt: f.created_at,
  }))
}

export async function listOutgoingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIEND_SELECT)
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(f => ({
    friendshipId: f.id,
    addressee: f.addressee,
    createdAt: f.created_at,
  }))
}

export async function listPendingGuestInvites(userId) {
  const { data, error } = await supabase
    .from('guest_profiles')
    .select('id, phone, created_at')
    .eq('invited_by', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── Friendship lookups ─────────────────────────────────────────

/** All non-soft-deleted friendships involving userId — used for status maps and block lists. */
export async function getAllActiveFriendships(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .is('deleted_at', null)
  if (error) throw error
  return data ?? []
}

/** Single active friendship row between two users, or null. */
export async function getActiveFriendship(userId, otherUserId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, addressee_id')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),` +
      `and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`,
    )
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

// ── Search ─────────────────────────────────────────────────────

export async function searchProfilesByName(query, userId, blockedIds = []) {
  let q = supabase
    .from('profiles')
    .select('id, name, avatar_url, upi_id')
    .ilike('name', `%${query}%`)
    .neq('id', userId)
    .is('deleted_at', null)
    .limit(10)
  if (blockedIds.length > 0) {
    q = q.not('id', 'in', `(${blockedIds.join(',')})`)
  }
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function searchProfileByPhone(phone, userId, blockedIds = []) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, upi_id, phone')
    .eq('phone', phone)
    .neq('id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  if (blockedIds.includes(data.id)) return null
  return data
}

// ── Mutations ──────────────────────────────────────────────────

/**
 * App-layer pre-check before INSERT — surfaces meaningful errors instead of
 * relying solely on DB constraint messages. Checks for blocked status explicitly
 * because blocked rows have deleted_at=null and the unique index still covers them,
 * but we want to fail with a clear error, not a constraint violation.
 */
export async function sendFriendRequest(addresseeId, userId) {
  const existing = await getActiveFriendship(userId, addresseeId)
  if (existing?.status === 'blocked') throw new Error('BLOCKED')
  if (existing?.status === 'pending') throw new Error('ALREADY_PENDING')
  if (existing?.status === 'accepted') throw new Error('ALREADY_FRIENDS')

  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: userId, addressee_id: addresseeId })
  if (error) {
    if (error.code === '23505') throw new Error('ALREADY_PENDING')
    if (error.code === '23514') throw new Error('SELF_ADD')
    throw error
  }
}

export async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
  if (error) throw error
}

export async function rejectFriendRequest(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', friendshipId)
  if (error) throw error
}

export async function cancelFriendRequest(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', friendshipId)
  if (error) throw error
}

export async function unfriend(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', friendshipId)
  if (error) throw error
}

export async function blockFriend(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'blocked' })
    .eq('id', friendshipId)
  if (error) throw error
}

/**
 * Creates a guest invite. Block-check runs first: if a profile with this phone
 * exists and there's a blocked relationship, we decline generically without
 * revealing the person is on the platform.
 */
export async function createGuestInvite(phone, userId) {
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) throw new Error('INVALID_PHONE')

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', normalizedPhone)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingProfile) {
    const friendship = await getActiveFriendship(userId, existingProfile.id)
    if (friendship?.status === 'blocked') throw new Error('BLOCKED')
  }

  const { error } = await supabase
    .from('guest_profiles')
    .insert({ phone: normalizedPhone, invited_by: userId })
  if (error) {
    if (error.code === '23505') throw new Error('INVITE_EXISTS')
    throw error
  }
}

export async function cancelGuestInvite(inviteId) {
  const { error } = await supabase
    .from('guest_profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', inviteId)
  if (error) throw error
}
