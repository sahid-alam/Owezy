import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../lib/auth.js'
import { signInSchema, signUpSchema } from '../lib/schemas/auth.js'

export default function SignIn() {
  const [mode, setMode] = useState('signin')
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const schema = mode === 'signin' ? signInSchema : signUpSchema
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  async function onSubmit({ email, password }) {
    setServerError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        const { session } = await signUpWithEmail(email, password)
        if (!session) {
          // Email confirmation required — onAuthStateChange fires once user confirms
          setConfirmationSent(true)
          return
        }
      }
    } catch (err) {
      setServerError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setServerError('')
    try {
      await signInWithGoogle(window.location.origin + '/auth/callback')
    } catch (err) {
      setServerError(err.message ?? 'Could not open Google sign-in.')
    }
  }

  if (confirmationSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-gray-500">
            We sent a confirmation link to your inbox. Click it to finish signing up.
          </p>
          <button
            onClick={() => { setConfirmationSent(false); setMode('signin') }}
            className="text-sm text-indigo-600 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Splitr</h1>

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-gray-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="flex-1 border-t border-gray-200" />
          or
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <input
              {...register('email')}
              type="email"
              placeholder="Email"
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div>
            <input
              {...register('password')}
              type="password"
              placeholder="Password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="text-xs text-red-500">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setServerError('') }}
            className="text-indigo-600 hover:underline"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
