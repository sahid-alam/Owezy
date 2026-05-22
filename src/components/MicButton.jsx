import { useState, useEffect, useRef } from 'react'
import { isSpeechSupported, startTranscription } from '../lib-web/speech.js'

/**
 * Tap to start recording, tap again to stop.
 * Shows live transcript preview (last 60 chars) while recording.
 * Disabled with tooltip on unsupported browsers (Firefox).
 *
 * Props:
 *   onTranscript(text: string) — called with final transcript on stop
 *   disabled — external disable (e.g. rate limit reached)
 *   className — extra classes on the outer wrapper
 */
export default function MicButton({ onTranscript, disabled = false, className = '' }) {
  const [recording,   setRecording]   = useState(false)
  const [preview,     setPreview]     = useState('')
  const stopRef       = useRef(null)
  const fullTextRef   = useRef('')        // full transcript, not truncated
  const supported = isSpeechSupported()

  function handleToggle() {
    if (!recording) {
      setPreview('')
      fullTextRef.current = ''
      const { stop } = startTranscription({
        onResult: (text) => { fullTextRef.current = text; setPreview(text.slice(-60)) },
        onError:  ()     => { setRecording(false); setPreview(''); fullTextRef.current = '' },
        onEnd:    ()     => { setRecording(false) },
      })
      stopRef.current = stop
      setRecording(true)
    } else {
      stopRef.current?.()
      onTranscript(fullTextRef.current)  // send full transcript, not display slice
      setRecording(false)
    }
  }

  // Stop on unmount
  useEffect(() => () => stopRef.current?.(), [])

  if (!supported) return null

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label={recording ? 'Stop recording' : 'Start voice input'}
        className={`
          relative p-2 rounded-full transition-colors
          ${recording
            ? 'bg-red-100 text-red-600 ring-2 ring-red-300 ring-offset-1'
            : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
          }
          disabled:opacity-40 disabled:cursor-not-allowed
        `}
      >
        {recording && (
          <span className="absolute inset-0 rounded-full bg-red-200 animate-ping opacity-60" />
        )}
        <svg className="w-5 h-5 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
        </svg>
      </button>
      {recording && preview && (
        <p className="text-xs text-gray-400 max-w-[140px] text-center truncate">
          {preview}
        </p>
      )}
    </div>
  )
}
