const PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']

// FNV-1a 32-bit hash — deterministic across platforms
export function getAvatarColor(userId) {
  let h = 2166136261
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return PALETTE[h % PALETTE.length]
}

export function generateInitials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
