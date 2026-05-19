import { supabase } from './supabase.js'

/** @returns {Promise<import('@supabase/supabase-js').Session | null>} */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * @param {(event: string, session: import('@supabase/supabase-js').Session | null) => void} callback
 * @returns {{ data: { subscription: { unsubscribe: () => void } } }}
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

/** @param {string} redirectTo */
export async function signInWithGoogle(redirectTo) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw error
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
