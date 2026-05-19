import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { nameSchema } from '../../lib/schemas/onboarding.js'
import OnboardingShell from '../../components/OnboardingShell.jsx'

export default function Name({ step, profile, updateProfile, onNext }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(nameSchema),
  })

  useEffect(() => {
    if (profile?.name) setValue('name', profile.name)
  }, [profile?.name, setValue])

  async function onSubmit({ name }) {
    await updateProfile({ name: name.trim() })
    onNext()
  }

  return (
    <OnboardingShell step={step} onBack={null} onSkip={null}>
      <div>
        <h1 className="text-2xl font-bold">What should we call you?</h1>
        <p className="mt-1 text-sm text-gray-500">This is how your friends will see you.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <input
            {...register('name')}
            type="text"
            placeholder="Your name"
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
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
