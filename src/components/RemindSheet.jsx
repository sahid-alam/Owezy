import { useState } from 'react'
import toast from 'react-hot-toast'
import { buildReminderMessage, getReminderTarget } from '../lib/reminders.js'
import { buildWhatsAppLink } from '../lib/whatsapp.js'

/**
 * @param {{
 *   friend: { name: string, phone?: string|null },
 *   balance: { netAmount: number },
 *   onClose: () => void
 * }} props
 */
export default function RemindSheet({ friend, balance, onClose }) {
  const defaultMessage = buildReminderMessage({
    amount:      balance.netAmount,
    payerName:   friend.name,
    contextName: 'your recent expenses',
  })
  const [message, setMessage] = useState(defaultMessage)
  const target = getReminderTarget({ friendPhone: friend.phone })

  function handleSend() {
    if (target === 'whatsapp') {
      try {
        const link = buildWhatsAppLink({ phone: friend.phone, message })
        window.open(link, '_blank', 'noopener,noreferrer')
        onClose()
      } catch {
        toast.error("Couldn't open WhatsApp — check the phone number")
      }
    } else {
      navigator.clipboard
        .writeText(message)
        .then(() => {
          toast.success('Copied to clipboard')
          onClose()
        })
        .catch(() => toast.error("Couldn't copy — try manually"))
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-30"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-40 px-4 pt-5 pb-8 shadow-xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Remind {friend.name}
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          {target === 'whatsapp'
            ? 'Opens WhatsApp with this message'
            : `${friend.name} has no phone number — copy the message instead`}
        </p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold"
          >
            {target === 'whatsapp' ? 'Send via WhatsApp' : 'Copy reminder text'}
          </button>
        </div>
      </div>
    </>
  )
}
