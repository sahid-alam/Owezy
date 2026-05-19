import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { phoneSchema } from '../../lib/schemas/onboarding.js'
import OnboardingShell from '../../components/OnboardingShell.jsx'

export default function Phone({ step, updateProfile, onNext, onBack }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(phoneSchema),
  })

  async function onSubmit({ phone }) {
    await updateProfile({ phone })
    onNext()
  }

  async function handleSkip() {
    await updateProfile({ onboarding_phone_skipped: true, onboarding_completed: true })
    onNext()
  }

  return (
    <OnboardingShell step={step} onBack={onBack} onSkip={handleSkip}>
      <div>
        <h1 className="text-2xl font-bold">Number to text you on</h1>
        <p className="mt-1 text-sm text-gray-500">
          Used for reminders and to link you with friends who added you as a guest.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <input
            {...register('phone')}
            type="tel"
            placeholder="+919876543210"
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Continue →'}
        </button>
      </form>
    </OnboardingShell>
  )
}
