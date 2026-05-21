import { supabase } from './supabase.js'

export async function listNotifications({ limit = 30, before } = {}) {
  let q = supabase
    .from('notifications')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getUnreadCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .is('deleted_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  if (error) throw error
}

export async function markAllRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
    .is('deleted_at', null)
  if (error) throw error
}

/**
 * Subscribe to new notifications for a user via Supabase Realtime.
 * Returns an unsubscribe function — call it on unmount to avoid leaks.
 * @param {string} userId
 * @param {(payload: object) => void} onInsert
 * @returns {() => void} unsubscribe
 */
export function subscribeToNotifications(userId, onInsert) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `recipient_id=eq.${userId}`,
      },
      onInsert
    )
    .subscribe()

  return () => { channel.unsubscribe() }
}
