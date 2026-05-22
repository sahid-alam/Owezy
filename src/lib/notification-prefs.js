import { supabase } from './supabase.js'

/**
 * Single source of truth for notification preference metadata.
 * Components never hardcode labels or section groupings.
 */
export const NOTIFICATION_PREF_MAP = [
  { key: 'new_expense',          label: 'New expense added',         section: 'Expenses'     },
  { key: 'expense_edited',       label: 'Expense edited',            section: 'Expenses'     },
  { key: 'settlement_initiated', label: 'Payment claim received',    section: 'Settlements'  },
  { key: 'settlement_confirmed', label: 'Payment confirmed',         section: 'Settlements'  },
  { key: 'reminder',             label: 'Debt reminders',            section: 'Reminders'    },
  { key: 'friend_request',       label: 'Friend requests',           section: 'Social'       },
  { key: 'group_membership',     label: 'Added/removed from group',  section: 'Social'       },
  { key: 'group_admin',          label: 'Admin role changes',        section: 'Social'       },
  { key: 'trip_ended',           label: 'Trip ended',                section: 'Trip'         },
]

/** @returns {Promise<object|null>} */
export async function getMyNotificationPrefs() {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Partial update of any toggle columns.
 * UPSERT is safe if the row is missing for any reason (handle_new_profile normally creates it).
 * @param {string} profileId
 * @param {object} patch — e.g. { new_expense: false }
 */
export async function updateMyNotificationPrefs(profileId, patch) {
  const { error } = await supabase
    .from('notification_prefs')
    .upsert({ profile_id: profileId, ...patch }, { onConflict: 'profile_id' })
  if (error) throw error
}
