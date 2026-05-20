/**
 * Normalises a phone number to E.164 format.
 * Accepts: "+919876543210", "9876543210", "09876543210"
 * Returns null for unrecognisable input.
 * @param {string} input
 * @param {string} defaultCountryCode
 * @returns {string|null}
 */
export function normalizePhone(input, defaultCountryCode = '+91') {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+')) return '+' + digits
  if (digits.length === 10) return defaultCountryCode + digits
  if (digits.length === 11 && digits.startsWith('0')) return defaultCountryCode + digits.slice(1)
  return null
}
