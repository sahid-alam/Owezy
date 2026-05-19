import { useState, useRef, useEffect } from 'react'
import OnboardingShell from '../../components/OnboardingShell.jsx'

export default function Photo({ step, profile, uploadAvatar, onNext, onBack }) {
  const [previewUrl, setPreviewUrl] = useState(profile?.avatar_url ?? null)
  const [pendingFile, setPendingFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setPendingFile(file)
  }

  async function handleSubmit() {
    if (!pendingFile) { onNext(); return }
    setUploading(true)
    setError('')
    try {
      await uploadAvatar(pendingFile) // compressImage + upload happens in useProfile
      onNext()
    } catch {
      setError("Upload failed — check your connection and try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <OnboardingShell step={step} onBack={onBack} onSkip={onNext}>
      <div>
        <h1 className="text-2xl font-bold">Add a photo</h1>
        <p className="mt-1 text-sm text-gray-500">So friends recognise you at a glance.</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-300 hover:border-indigo-400 overflow-hidden flex items-center justify-center bg-gray-50"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl text-gray-300">+</span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {previewUrl && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-indigo-600 hover:underline"
          >
            Choose a different photo
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={uploading}
        className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : previewUrl ? 'Use this photo →' : 'Continue →'}
      </button>
    </OnboardingShell>
  )
}
