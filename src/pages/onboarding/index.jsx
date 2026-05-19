import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile.js'
import { useOnboardingStore, getFirstIncompleteStep } from '../../store/onboarding.js'
import Name from './Name.jsx'
import Photo from './Photo.jsx'
import Phone from './Phone.jsx'
import Upi from './Upi.jsx'

export default function OnboardingIndex() {
  const { profile, isLoading, updateProfile, uploadAvatar } = useProfile()
  const { step, setStep, nextStep, prevStep } = useOnboardingStore()

  // On mount (or when profile first loads), jump to the correct resume step
  useEffect(() => {
    if (!profile) return
    const resumeStep = getFirstIncompleteStep(profile)
    setStep(resumeStep)
  }, [profile?.id]) // only re-derive on profile identity change, not every update

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (step >= 4) return <Navigate to="/home" replace />

  const commonProps = { profile, updateProfile, onNext: nextStep }

  switch (step) {
    case 0:
      return <Name step={0} {...commonProps} onBack={null} />
    case 1:
      return <Photo step={1} profile={profile} uploadAvatar={uploadAvatar} onNext={nextStep} onBack={prevStep} />
    case 2:
      return <Phone step={2} updateProfile={updateProfile} onNext={nextStep} onBack={prevStep} />
    case 3:
      return <Upi step={3} updateProfile={updateProfile} onNext={nextStep} onBack={prevStep} />
    default:
      return <Navigate to="/home" replace />
  }
}
