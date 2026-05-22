import { useInstallPrompt } from '../hooks/useInstallPrompt.js'

export default function InstallBanner() {
  const { show, showIos, install, dismiss, dismissIos } = useInstallPrompt()

  if (show) {
    return (
      <div className="mx-4 mb-4 rounded-xl bg-indigo-50 border border-indigo-100 p-4 flex items-center gap-3">
        <div className="text-2xl">📲</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-indigo-900">Install Owezy</p>
          <p className="text-xs text-indigo-600 mt-0.5">Add to home screen for the full experience</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={install}
            className="text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg"
          >
            Install
          </button>
          <button
            onClick={dismiss}
            className="text-xs text-indigo-400 px-2 py-1.5"
          >
            Not now
          </button>
        </div>
      </div>
    )
  }

  if (showIos) {
    return (
      <div className="mx-4 mb-4 rounded-xl bg-indigo-50 border border-indigo-100 p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📲</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-indigo-900">Install Owezy</p>
            <p className="text-xs text-indigo-600 mt-1">
              Tap <span className="font-semibold">Share</span> <span className="text-base">⎙</span> then{' '}
              <span className="font-semibold">Add to Home Screen</span>
            </p>
          </div>
          <button onClick={dismissIos} className="text-indigo-300 text-lg leading-none">×</button>
        </div>
      </div>
    )
  }

  return null
}
