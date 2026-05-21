import { useNavigate } from 'react-router-dom'
import { useNotifications, useMarkRead, useMarkAllRead } from '../hooks/useNotifications.js'

function timeAgo(dateStr) {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (secs < 60)  return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  const days = Math.floor(secs / 86400)
  return days === 1 ? 'yesterday' : `${days}d ago`
}
import { getNotificationCopy } from '../lib/notification-copy.js'

function NotificationIcon({ type }) {
  const cls = 'w-5 h-5 flex-shrink-0'
  switch (type) {
    case 'new_expense':
    case 'expense_edited':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      )
    case 'reminder':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )
    case 'settlement_initiated':
    case 'settlement_confirmed':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
      )
    case 'group_added':
    case 'group_removed':
    case 'group_admin_granted':
    case 'group_admin_revoked':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
        </svg>
      )
    default:
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
  }
}

export default function Notifications() {
  const navigate = useNavigate()
  const { notifications, isLoading } = useNotifications()
  const markRead    = useMarkRead()
  const markAllRead = useMarkAllRead()

  const hasUnread = notifications.some((n) => !n.read_at)

  function handleTap(n) {
    const { deepLink } = getNotificationCopy(n.type, n.data)
    if (!n.read_at) markRead.mutate(n.id)
    navigate(deepLink)
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-indigo-600 font-medium"
        >
          ← Back
        </button>
        <h1 className="text-base font-semibold text-gray-900">Notifications</h1>
        {hasUnread ? (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-sm text-indigo-600 font-medium disabled:opacity-40"
          >
            Mark all read
          </button>
        ) : (
          <div className="w-20" />
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 gap-2">
          <p className="text-base font-semibold text-gray-700">Nothing new.</p>
          <p className="text-sm text-gray-400">Catch up on a chai ☕</p>
        </div>
      ) : (
        <div>
          {notifications.map((n) => {
            const { title, body } = getNotificationCopy(n.type, n.data)
            const isUnread = !n.read_at
            const ago = timeAgo(n.created_at)

            return (
              <button
                key={n.id}
                onClick={() => handleTap(n)}
                className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 text-left active:bg-gray-50 ${
                  isUnread ? 'bg-indigo-50/40' : 'bg-white'
                }`}
              >
                <div className={`mt-0.5 ${isUnread ? 'text-indigo-500' : 'text-gray-400'}`}>
                  <NotificationIcon type={n.type} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {title}
                    </p>
                    {isUnread && (
                      <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 leading-snug">{body}</p>
                  <p className="text-xs text-gray-400 mt-1">{ago}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
