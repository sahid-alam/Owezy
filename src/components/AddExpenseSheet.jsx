import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMyGroups } from '../hooks/useGroups.js'

/**
 * FAB bottom sheet for choosing expense context.
 * Props: onClose()
 */
export default function AddExpenseSheet({ onClose }) {
  const navigate = useNavigate()
  const { groups } = useMyGroups()
  const [step, setStep] = useState('root')  // 'root' | 'group'

  function handleFriends() {
    onClose()
    navigate('/expenses/new')
  }

  function handleGroup(groupId) {
    onClose()
    navigate(`/expenses/new?groupId=${groupId}`)
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl">

        {step === 'root' && (
          <>
            <div className="px-4 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Add expense</h3>
            </div>
            <div className="py-1">
              <button
                onClick={handleFriends}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m0 0a4 4 0 110-7.26M15 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">Between friends</p>
                  <p className="text-xs text-gray-400 mt-0.5">Just you and someone specific</p>
                </div>
              </button>

              {groups.length > 0 && (
                <button
                  onClick={() => setStep('group')}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M17 20h5v-2a3 3 0 00-3-3H5a3 3 0 00-3 3v2h5m6 0a2 2 0 100-4 2 2 0 000 4zm0 0h.01M12 12a4 4 0 100-8 4 4 0 000 8z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">In a group</p>
                    <p className="text-xs text-gray-400 mt-0.5">Pick a group to add to</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={onClose}
                className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'group' && (
          <>
            <div className="px-4 pt-5 pb-3 border-b border-gray-100 flex items-center gap-3">
              <button
                onClick={() => setStep('root')}
                className="text-sm text-indigo-600 font-medium"
              >
                ← Back
              </button>
              <h3 className="text-base font-semibold text-gray-900">Pick a group</h3>
            </div>
            <div className="overflow-y-auto max-h-72 py-1">
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => handleGroup(g.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-indigo-700">
                      {g.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-900 text-left">{g.name}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={onClose}
                className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
