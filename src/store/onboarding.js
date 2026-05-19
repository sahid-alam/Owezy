import { create } from 'zustand'

export const useOnboardingStore = create((set) => ({
  step: 0,
  setStep: (step) => set({ step }),
  nextStep: () => set((state) => ({ step: state.step + 1 })),
  prevStep: () => set((state) => ({ step: Math.max(0, state.step - 1) })),
}))

/**
 * Returns the step index to resume at based on profile data.
 * Only returns 0 (name) or 2 (phone) — photo/UPI are only surfaced in
 * first-time linear flow, not in resumption.
 * @param {object} profile
 * @returns {number} step index
 */
export function getFirstIncompleteStep(profile) {
  if (!profile || !profile.name || profile.name.trim() === '') return 0
  if (!profile.phone && !profile.onboarding_phone_skipped) return 2
  return 3 // name + phone done but wizard not completed — resume at UPI
}
