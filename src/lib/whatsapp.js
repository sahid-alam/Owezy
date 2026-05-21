/**
 * Pure WhatsApp link builder. No DOM, no window, no side effects.
 * Component is responsible for window.open() / window.location calls.
 *
 * wa.me requires the number WITHOUT a leading '+'.
 * E.g. +919876543210 → 919876543210
 *
 * @param {{ phone: string, message: string }} options
 * @returns {string} https://wa.me/... URL
 */
export function buildWhatsAppLink({ phone, message }) {
  if (!phone || !phone.trim()) throw new Error('phone is required')

  const digits = phone.trim().replace(/^\+/, '').replace(/\D/g, '')
  if (!digits) throw new Error('phone contains no digits')

  const encoded = encodeURIComponent(message || '')
  return `https://wa.me/${digits}?text=${encoded}`
}
