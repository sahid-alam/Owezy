// Browser-only Web Speech API wrapper.
// Do NOT import this from src/lib/ — it uses browser globals.

export function isSpeechSupported() {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
}

/**
 * Start a live speech transcription session.
 * @param {{ onResult: (text: string) => void, onError: (err: Error) => void, onEnd: () => void }} handlers
 * @returns {{ stop: () => void }}
 */
export function startTranscription({ onResult, onError, onEnd }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    const err = new Error('Speech recognition not supported in this browser')
    err.name  = 'NotSupportedError'
    onError(err)
    return { stop: () => {} }
  }

  const recognition = new SpeechRecognition()
  recognition.lang        = 'en-IN'
  recognition.continuous  = true
  recognition.interimResults = true

  let finalTranscript = ''

  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += text + ' '
      } else {
        interim = text
      }
    }
    onResult((finalTranscript + interim).trim())
  }

  recognition.onerror = (event) => {
    if (event.error === 'no-speech') return  // benign
    const err = new Error(`Speech recognition error: ${event.error}`)
    onError(err)
  }

  recognition.onend = () => {
    onEnd()
  }

  recognition.start()

  return {
    stop: () => {
      try { recognition.stop() } catch { /* ignore */ }
    },
  }
}
