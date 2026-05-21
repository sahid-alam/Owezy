/**
 * Single source of truth for notification display strings.
 * Pure functions: take notification.data, return { title, body, deepLink }.
 * Components never construct notification copy inline.
 *
 * @param {string} type
 * @param {object} data  — the notification.data JSONB from DB
 * @returns {{ title: string, body: string, deepLink: string }}
 */
export function getNotificationCopy(type, data = {}) {
  switch (type) {
    case 'new_expense':
      return {
        title:    'New expense',
        body:     `${data.actor_name || 'Someone'} added "${data.title}"`,
        deepLink: `/expenses/${data.expense_id}`,
      }

    case 'expense_edited':
      return {
        title:    'Expense updated',
        body:     `${data.actor_name || 'Someone'} updated "${data.title}"`,
        deepLink: `/expenses/${data.expense_id}`,
      }

    case 'reminder':
      return {
        title:    'Payment reminder',
        body:     `₹${data.amount} pending with ${data.creditor_name || 'a friend'}. Settle now?`,
        deepLink: `/settle/${data.creditor_id}`,
      }

    case 'settlement_initiated':
      return {
        title:    'Payment claim',
        body:     `${data.payer_name || 'Someone'} says they paid you ₹${data.amount}`,
        deepLink: `/settlements/${data.settlement_id}/confirm`,
      }

    case 'settlement_confirmed':
      return {
        title:    'Payment confirmed',
        body:     `${data.payee_name || 'Your friend'} confirmed your ₹${data.amount} payment`,
        deepLink: `/friends/${data.payee_id}`,
      }

    case 'group_added':
      return data.context === 'trip' ? {
        title:    'Added to trip',
        body:     `${data.actor_name || 'Someone'} added you to "${data.group_name}"`,
        deepLink: `/trips/${data.group_id}`,
      } : {
        title:    'Added to group',
        body:     `${data.actor_name || 'Someone'} added you to "${data.group_name}"`,
        deepLink: `/groups/${data.group_id}`,
      }

    case 'group_removed':
      return data.context === 'trip' ? {
        title:    'Removed from trip',
        body:     `You were removed from "${data.group_name}"`,
        deepLink: `/trips`,
      } : {
        title:    'Removed from group',
        body:     `You were removed from "${data.group_name}"`,
        deepLink: `/groups`,
      }

    case 'group_admin_granted':
      return data.context === 'trip' ? {
        title:    "You're now a trip admin",
        body:     `You were made an admin of "${data.group_name}"`,
        deepLink: `/trips/${data.group_id}`,
      } : {
        title:    "You're now an admin",
        body:     `You were made an admin of "${data.group_name}"`,
        deepLink: `/groups/${data.group_id}`,
      }

    case 'group_admin_revoked':
      return data.context === 'trip' ? {
        title:    'Trip admin role removed',
        body:     `Your admin role in "${data.group_name}" was removed`,
        deepLink: `/trips/${data.group_id}`,
      } : {
        title:    'Admin role removed',
        body:     `Your admin role in "${data.group_name}" was removed`,
        deepLink: `/groups/${data.group_id}`,
      }

    case 'trip_ended':
      return {
        title:    'Trip ended',
        body:     `"${data.trip_name}" has ended. Time to settle up!`,
        deepLink: `/groups`,
      }

    case 'friend_request_received':
      return {
        title:    'Friend request',
        body:     `${data.requester_name || 'Someone'} wants to connect`,
        deepLink: `/friends`,
      }

    case 'friend_request_accepted':
      return {
        title:    'Request accepted',
        body:     `${data.accepter_name || 'Someone'} accepted your friend request`,
        deepLink: `/friends`,
      }

    default:
      return {
        title:    'Notification',
        body:     'You have a new notification',
        deepLink: `/home`,
      }
  }
}

/** Icon name (for rendering in Notifications.jsx) keyed by type */
export const NOTIFICATION_ICON = {
  new_expense:              'receipt',
  expense_edited:           'pencil',
  reminder:                 'bell',
  settlement_initiated:     'money',
  settlement_confirmed:     'check',
  group_added:              'group',
  group_removed:            'group',
  group_admin_granted:      'star',
  group_admin_revoked:      'star',
  trip_ended:               'flag',
  friend_request_received:  'person',
  friend_request_accepted:  'person-check',
}
