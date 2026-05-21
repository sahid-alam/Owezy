import { useState } from 'react'
import { getAvatarColor, generateInitials } from '../lib/avatar.js'

export default function Avatar({ userId, name, avatarUrl, size = 40 }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const color    = getAvatarColor(userId || 'default')
  const initials = generateInitials(name)
  const fontSize = Math.round(size * 0.38)

  function handleTap() {
    setShowTooltip(true)
    setTimeout(() => setShowTooltip(false), 2000)
  }

  return (
    <div
      className="relative inline-block flex-shrink-0"
      style={{ width: size, height: size }}
      onClick={handleTap}
      title={name}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="rounded-full object-cover w-full h-full"
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
        />
      ) : null}
      <div
        className="rounded-full flex items-center justify-center font-bold text-white select-none"
        style={{
          width: size,
          height: size,
          background: color,
          fontSize,
          display: avatarUrl ? 'none' : 'flex',
        }}
      >
        {initials}
      </div>
      {showTooltip && name && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
          {name}
        </div>
      )}
    </div>
  )
}
