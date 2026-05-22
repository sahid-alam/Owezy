import { useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth.js'
import { useProfile } from '../hooks/useProfile.js'
import { useNotificationPrefs, useUpdateNotificationPref } from '../hooks/useNotificationPrefs.js'
import { NOTIFICATION_PREF_MAP } from '../lib/notification-prefs.js'
import { nameSchema, phoneSchema, upiSchema } from '../lib/schemas/onboarding.js'
import { generateInitials, getAvatarColor } from '../lib/avatar.js'
import InlineEditField from '../components/InlineEditField.jsx'
import PrefToggleGroup from '../components/PrefToggleGroup.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

const SECTION_ORDER = ['Expenses', 'Settlements', 'Reminders', 'Social', 'Trip']

const UPI_APP_OPTIONS = [
  { value: '',        label: 'Not set'  },
  { value: 'gpay',    label: 'GPay'     },
  { value: 'phonepe', label: 'PhonePe'  },
  { value: 'paytm',   label: 'Paytm'    },
]

export default function Profile() {
  const navigate    = useNavigate()
  const { signOut } = useAuth()
  const { profile, updateProfile, uploadAvatar, removeAvatar } = useProfile()
  const { prefs }   = useNotificationPrefs()
  const updatePref  = useUpdateNotificationPref()

  const fileRef = useRef(null)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [avatarLoading,  setAvatarLoading]  = useState(false)
  const [signOutOpen,    setSignOutOpen]    = useState(false)

  const prefSections = useMemo(() =>
    SECTION_ORDER.map(section => ({
      section,
      prefs: NOTIFICATION_PREF_MAP.filter(p => p.section === section),
    }))
  , [])

  const initials = profile?.name ? generateInitials(profile.name) : '?'
  const bgColor  = profile?.id   ? getAvatarColor(profile.id) : '#6366f1'

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setAvatarLoading(true)
    try {
      await uploadAvatar(file)
      toast.success('Photo updated')
    } catch {
      toast.error("Couldn't upload photo")
    } finally {
      setAvatarLoading(false)
    }
  }

  async function handleRemovePhoto() {
    setAvatarMenuOpen(false)
    try {
      await removeAvatar()
      toast.success('Photo removed')
    } catch {
      toast.error("Couldn't remove photo")
    }
  }

  async function handleSignOut() {
    setSignOutOpen(false)
    await signOut()
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center z-10">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-medium mr-auto">
          ← Back
        </button>
        <h1 className="text-base font-semibold text-gray-900 absolute left-1/2 -translate-x-1/2">
          Profile
        </h1>
      </div>

      {/* ── Section 1: Profile ─────────────────────────── */}
      <div className="pt-8 pb-2 flex flex-col items-center">
        {/* Avatar + action sheet */}
        <div className="relative">
          <button
            onClick={() => setAvatarMenuOpen(v => !v)}
            className="relative w-20 h-20 rounded-full overflow-hidden focus:outline-none"
            aria-label="Change profile photo"
          >
            {avatarLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: bgColor }}
              >
                <span className="text-2xl font-bold text-white">{initials}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 flex items-end justify-center pb-1.5 opacity-0 hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </button>

          {avatarMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAvatarMenuOpen(false)} />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 z-20 w-44 overflow-hidden">
                <button
                  onClick={() => { setAvatarMenuOpen(false); fileRef.current?.click() }}
                  className="w-full px-4 py-3 text-sm text-left text-gray-700 hover:bg-gray-50"
                >
                  Change photo
                </button>
                {profile?.avatar_url && (
                  <button
                    onClick={handleRemovePhoto}
                    className="w-full px-4 py-3 text-sm text-left text-red-500 hover:bg-red-50 border-t border-gray-100"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <p className="mt-3 text-xl font-bold text-gray-900">{profile?.name || '…'}</p>
      </div>

      {/* Name */}
      <InlineEditField
        label="Name"
        value={profile?.name ?? ''}
        schema={nameSchema}
        placeholder="Your name"
        onSave={async (val) => {
          await updateProfile({ name: val })
          toast.success('Updated')
        }}
      />

      {/* Phone — updates profiles.phone only, NOT auth.users.phone (OTP deferred to Phase 2) */}
      <InlineEditField
        label="Phone"
        value={profile?.phone ?? ''}
        schema={phoneSchema}
        type="tel"
        placeholder="+919876543210"
        onSave={async (val) => {
          await updateProfile({ phone: val })
          toast.success('Updated')
        }}
      />

      {/* UPI ID */}
      <InlineEditField
        label="UPI ID"
        value={profile?.upi_id ?? ''}
        schema={upiSchema}
        placeholder="name@bank"
        onSave={async (val) => {
          await updateProfile({ upi_id: val })
          toast.success('Updated')
        }}
      />

      {/* Preferred UPI app — display only; per-app deep link variants are Phase 2 */}
      <div className="px-4 py-3.5 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Preferred UPI app
        </p>
        <select
          value={profile?.preferred_upi_app ?? ''}
          onChange={async e => {
            await updateProfile({ preferred_upi_app: e.target.value || null })
            toast.success('Updated')
          }}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 bg-white text-gray-900"
        >
          {UPI_APP_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ── Section 2: Notifications ────────────────────── */}
      <div className="mt-6">
        <p className="px-4 pb-0.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Notifications
        </p>
        <p className="px-4 pb-3 text-xs text-gray-400 leading-relaxed">
          Turning off a type stops future notifications — existing ones stay in your feed.
        </p>
        {prefSections.map(({ section, prefs: sectionPrefs }) => (
          <PrefToggleGroup
            key={section}
            title={section}
            prefs={sectionPrefs}
            values={prefs}
            onChange={(key, value) => updatePref.mutate({ [key]: value })}
          />
        ))}
      </div>

      {/* ── Section 3: Account ──────────────────────────── */}
      <div className="mt-6 border-t border-gray-100">
        <button
          onClick={() => setSignOutOpen(true)}
          className="w-full px-4 py-4 text-sm font-medium text-red-500 text-left hover:bg-red-50 transition-colors"
        >
          Sign out
        </button>
      </div>

      {signOutOpen && (
        <ConfirmDialog
          title="Sign out?"
          confirmLabel="Sign out"
          danger
          onConfirm={handleSignOut}
          onCancel={() => setSignOutOpen(false)}
        />
      )}
    </div>
  )
}
