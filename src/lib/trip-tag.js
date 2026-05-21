// Priority order matters — first match wins. Do not reorder without product review.
export function computeTripTag({ total, categories, members, days }) {
  const pct = (cat) => total > 0 ? (categories[cat] ?? 0) / total : 0
  const ppd = total / Math.max(1, members) / Math.max(1, days)

  if (pct('food') > 0.40)
    return { tag: 'Foodie trip',    emoji: '🍕', color: '#f97316' }
  if (pct('accommodation') > 0.50)
    return { tag: 'Luxury trip',    emoji: '✨', color: '#a855f7' }
  if (ppd < 1500)
    return { tag: 'Budget bash',    emoji: '💸', color: '#22c55e' }
  if (ppd > 5000)
    return { tag: 'Big spender',    emoji: '🤑', color: '#eab308' }
  if (pct('transport') + pct('entertainment') > 0.50)
    return { tag: 'Adventure trip', emoji: '🎢', color: '#3b82f6' }
  return   { tag: 'Balanced trip',  emoji: '⚖️', color: '#6b7280' }
}

// categories: { food, accommodation, transport, entertainment, ... } keyed by category string
// members: number of trip members
// days: end_date - start_date + 1
