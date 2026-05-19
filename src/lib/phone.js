// Phone OTP deferred to Phase 2 — requires Supabase phone provider + SMS gateway.
// Stubs preserve call signatures so Phase 2 can restore without touching callers.

/** @throws {Error} Phone OTP disabled in MVP */
export async function sendOtp(_phone) {
  throw new Error('Phone OTP disabled in MVP — restore in Phase 2')
}

/** @throws {Error} Phone OTP disabled in MVP */
export async function verifyOtp(_phone, _token) {
  throw new Error('Phone OTP disabled in MVP — restore in Phase 2')
}
