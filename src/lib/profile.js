import { supabase } from './supabase.js'

/**
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

/**
 * @param {string} userId
 * @param {object} patch
 */
export async function updateMyProfile(userId, patch) {
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
  if (error) throw error
}

/**
 * Upload a compressed Blob to the avatars bucket.
 * Path: {userId}/{timestamp}.jpg — bucket name is implicit, never prepend it.
 * Storage RLS matches on foldername(name)[1] = userId.
 * @param {Blob} blob
 * @param {string} userId
 * @returns {Promise<string>} public URL
 */
export async function uploadAvatar(blob, userId) {
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Check if a guest_profiles row exists for this phone before claiming.
 * Called before claim_guest_profile() since the RPC returns void.
 * @param {string} phone
 * @returns {Promise<boolean>}
 */
export async function checkPendingGuestClaim(phone) {
  const { data } = await supabase
    .from('guest_profiles')
    .select('id')
    .eq('phone', phone)
    .is('deleted_at', null)
    .maybeSingle()
  return !!data
}

/** Calls the claim_guest_profile() RPC (SECURITY DEFINER, reads phone from profiles). */
export async function callClaimGuestProfile() {
  const { error } = await supabase.rpc('claim_guest_profile')
  if (error) throw error
}

/**
 * A profile is complete when name is set AND phone is set or explicitly skipped.
 * Photo and UPI are soft — they never block.
 * @param {object|null} profile
 * @returns {boolean}
 */
export function isProfileComplete(profile) {
  if (!profile) return false
  return (
    typeof profile.name === 'string' &&
    profile.name.trim() !== '' &&
    (!!profile.phone || profile.onboarding_phone_skipped === true)
  )
}
