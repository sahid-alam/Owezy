import clsx from 'clsx'

const TOTAL_STEPS = 4

/**
 * @param {{
 *   step: number,
 *   onBack?: () => void,
 *   onSkip?: () => void,
 *   children: React.ReactNode
 * }} props
 */
export default function OnboardingShell({ step, onBack, onSkip, children }) {
  return (
    <div className="flex flex-col items-center min-h-screen p-6">
      <div className="w-full max-w-sm flex flex-col gap-8 mt-8">

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={clsx(
                'w-2 h-2 rounded-full transition-colors',
                i <= step ? 'bg-indigo-600' : 'bg-gray-200',
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="flex flex-col gap-6">
          {children}
        </div>

        {/* Navigation row */}
        <div className="flex justify-between items-center">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Skip for now
            </button>
          ) : (
            <div />
          )}
        </div>

      </div>
    </div>
  )
}
