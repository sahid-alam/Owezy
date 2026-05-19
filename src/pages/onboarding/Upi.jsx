import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { upiSchema } from '../../lib/schemas/onboarding.js'
import OnboardingShell from '../../components/OnboardingShell.jsx'

export default function Upi({ step, updateProfile, onNext, onBack }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(upiSchema),
  })

  async function onSubmit({ upi_id }) {
    await updateProfile({ upi_id: upi_id.trim(), onboarding_completed: true })
    onNext()
  }

  async function handleSkip() {
    await updateProfile({ onboarding_upi_skipped: true, onboarding_completed: true })
    onNext()
  }

  return (
    <OnboardingShell step={step} onBack={onBack} onSkip={handleSkip}>
      <div>
        <h1 className="text-2xl font-bold">Your UPI ID</h1>
        <p className="mt-1 text-sm text-gray-500">
          So friends can pay you back directly. You can add this later too.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <input
            {...register('upi_id')}
            type="text"
            placeholder="yourname@upi"
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.upi_id && (
            <p className="mt-1 text-xs text-red-500">{errors.upi_id.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : "Let's go →"}
        </button>
      </form>
    </OnboardingShell>
  )
}
