const CATEGORY_EMOJI = {
  food:          '🍕',
  accommodation: '🏨',
  transport:     '🚌',
  entertainment: '🎭',
  groceries:     '🛒',
  shopping:      '🛍️',
  other:         '📦',
}

function formatINRCompact(amount) {
  if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L'
  if (amount >= 1000)   return '₹' + (amount / 1000).toFixed(1)  + 'K'
  return '₹' + Math.round(amount)
}

function formatINRFull(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function buildRecapCardSVG({
  tripName,
  destination,
  dateRange,
  totalSpent,
  memberCount,
  memberInitials,  // [{ initials, color }] up to 6
  topCategories,   // [{ category, amount, pct }] up to 3
  tag,             // { tag, emoji, color }
}) {
  const W = 1080
  const H = 1080
  const PAD = 72
  const CENTER = W / 2

  // Avatar row layout
  const maxAvatars = Math.min(memberInitials.length, 6)
  const avatarDia  = 80
  const avatarR    = avatarDia / 2
  const overlap    = 20
  const avatarStep = avatarDia - overlap
  const rowWidth   = maxAvatars * avatarDia - (maxAvatars - 1) * overlap
  const avatarStartX = CENTER - rowWidth / 2 + avatarR

  const avatarCircles = memberInitials.slice(0, maxAvatars).map((m, i) => {
    const cx = avatarStartX + i * avatarStep
    return `
      <circle cx="${cx}" cy="380" r="${avatarR}" fill="${m.color}" stroke="#4338ca" stroke-width="3"/>
      <text x="${cx}" y="388" text-anchor="middle" fill="white" font-size="28" font-weight="700"
        font-family="-apple-system, system-ui, sans-serif">${m.initials}</text>`
  }).join('')

  // Category bars
  const barMaxW  = W - PAD * 2 - 120 - 80  // space for emoji + name + pct
  const catRows  = topCategories.slice(0, 3).map((cat, i) => {
    const y       = 510 + i * 66
    const emoji   = CATEGORY_EMOJI[cat.category] || '📦'
    const barW    = Math.max(4, Math.round((cat.pct / 100) * barMaxW))
    const catName = cat.category.charAt(0).toUpperCase() + cat.category.slice(1)
    return `
      <text x="${PAD}" y="${y + 4}" font-size="32" font-family="-apple-system, system-ui, sans-serif">${emoji}</text>
      <text x="${PAD + 44}" y="${y + 4}" fill="white" font-size="22" font-family="-apple-system, system-ui, sans-serif"
        font-weight="500">${catName}</text>
      <rect x="${PAD + 44}" y="${y + 12}" width="${barW}" height="10" rx="5" fill="rgba(255,255,255,0.4)"/>
      <text x="${W - PAD}" y="${y + 4}" text-anchor="end" fill="rgba(255,255,255,0.7)" font-size="20"
        font-family="-apple-system, system-ui, sans-serif">${cat.pct}%</text>`
  }).join('')

  // Tag pill
  const tagText   = `${tag.emoji} ${tag.tag}`
  const pillW     = 300
  const pillH     = 52
  const pillX     = CENTER - pillW / 2
  const pillY     = 740

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#4338ca"/>

  <!-- Subtle texture overlay -->
  <rect width="${W}" height="${H}" fill="url(#grain)" opacity="0.04"/>
  <defs>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/></filter>
  </defs>

  <!-- Trip name -->
  <text x="${CENTER}" y="100" text-anchor="middle" fill="white" font-size="52" font-weight="700"
    font-family="-apple-system, system-ui, sans-serif">${escapeXml(tripName)}</text>

  <!-- Destination -->
  ${destination ? `<text x="${CENTER}" y="152" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="30"
    font-family="-apple-system, system-ui, sans-serif">${escapeXml(destination)}</text>` : ''}

  <!-- Date range -->
  <text x="${CENTER}" y="${destination ? 190 : 152}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="22"
    font-family="-apple-system, system-ui, sans-serif">${escapeXml(dateRange)}</text>

  <!-- Divider -->
  <line x1="${PAD}" y1="220" x2="${W - PAD}" y2="220" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>

  <!-- Total spent -->
  <text x="${CENTER}" y="306" text-anchor="middle" fill="white" font-size="80" font-weight="800"
    font-family="-apple-system, system-ui, sans-serif">${formatINRFull(totalSpent)}</text>
  <text x="${CENTER}" y="342" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="18"
    font-family="-apple-system, system-ui, sans-serif">total spent</text>

  <!-- Avatar circles -->
  ${avatarCircles}

  <!-- Member count -->
  <text x="${CENTER}" y="490" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="18"
    font-family="-apple-system, system-ui, sans-serif">${memberCount} ${memberCount === 1 ? 'person' : 'people'}</text>

  <!-- Divider -->
  <line x1="${PAD}" y1="502" x2="${W - PAD}" y2="502" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>

  <!-- Category rows -->
  ${topCategories.length > 0 ? `<text x="${PAD}" y="496" fill="rgba(255,255,255,0.5)" font-size="15" font-weight="600"
    font-family="-apple-system, system-ui, sans-serif" letter-spacing="1">TOP EXPENSES</text>` : ''}
  ${catRows}

  <!-- Trip tag pill -->
  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="26" fill="${tag.color}"/>
  <text x="${CENTER}" y="${pillY + 34}" text-anchor="middle" fill="white" font-size="24" font-weight="700"
    font-family="-apple-system, system-ui, sans-serif">${tagText}</text>

  <!-- Watermark -->
  <text x="${CENTER}" y="1056" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="16"
    font-family="-apple-system, system-ui, sans-serif">Made with Owezy</text>
</svg>`
}

function escapeXml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
