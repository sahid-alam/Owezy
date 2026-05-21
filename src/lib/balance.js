import { supabase } from './supabase.js'
import { toPaise, toRupees } from './money.js'

export async function getMyBalances() {
  const { data: authData } = await supabase.auth.getUser()
  const myId = authData?.user?.id
  if (!myId) throw new Error('Not authenticated')

  const { data, error } = await supabase.from('friend_balances').select('*')
  if (error) throw error

  const rows = data || []
  if (rows.length === 0) return []

  const friendIds = rows.map(r => (r.user_a === myId ? r.user_b : r.user_a))
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .in('id', friendIds)
  if (pErr) throw pErr

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  return rows.map(row => {
    const friendId = row.user_a === myId ? row.user_b : row.user_a
    const friend = profileMap[friendId] || {}
    const iOwe =
      (row.direction === 'b_owes_a' && row.user_b === myId) ||
      (row.direction === 'a_owes_b' && row.user_a === myId)
    return {
      friendId,
      friendName: friend.name,
      friendAvatar: friend.avatar_url,
      netAmount: Number(row.net_amount),
      direction: iOwe ? 'i_owe' : 'owes_me',
    }
  })
}

export async function getBalanceWithFriend(myId, friendId) {
  const userA = myId < friendId ? myId : friendId
  const userB = myId < friendId ? friendId : myId

  const { data, error } = await supabase
    .from('friend_balances')
    .select('*')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle()
  if (error) throw error

  // Pending settlements (initiated or paid) between the pair
  const { data: pending, error: sErr } = await supabase
    .from('settlements')
    .select('id, amount, note, status, payer_id, payee_id, created_at, paid_at, payer:profiles!payer_id(id, name, avatar_url)')
    .or(`and(payer_id.eq.${myId},payee_id.eq.${friendId}),and(payer_id.eq.${friendId},payee_id.eq.${myId})`)
    .in('status', ['initiated', 'paid'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (sErr) throw sErr

  if (!data) {
    return { netAmount: 0, direction: 'settled', pendingSettlements: pending || [] }
  }

  const iOwe =
    (data.direction === 'b_owes_a' && data.user_b === myId) ||
    (data.direction === 'a_owes_b' && data.user_a === myId)

  return {
    netAmount: Number(data.net_amount),
    direction: iOwe ? 'i_owe' : 'owes_me',
    pendingSettlements: pending || [],
  }
}

/**
 * Pure function — no Supabase, no side effects.
 * Computes outstanding expense obligations between myId and theirId after
 * applying confirmed settlements FIFO (oldest expense first).
 *
 * Returns:
 *   myDebts:    expenses where theirId paid and I still owe something
 *   theirDebts: expenses where I paid and they still owe something
 */
export function computeSourceBreakdown(expenses, settlements, myId, theirId) {
  // Build debt arrays sorted oldest-first
  const myDebts = []
  const theirDebts = []

  for (const e of expenses) {
    if (e.deleted_at) continue
    const activeSplits = (e.splits || []).filter(s => !s.deleted_at)

    if (e.paid_by === theirId) {
      const mySplit = activeSplits.find(s => s.profile_id === myId)
      if (mySplit && Number(mySplit.amount) > 0) {
        myDebts.push({
          expenseId: e.id,
          title: e.title,
          date: e.date,
          remaining: toPaise(mySplit.amount),
          originalAmount: Number(mySplit.amount),
        })
      }
    } else if (e.paid_by === myId) {
      const theirSplit = activeSplits.find(s => s.profile_id === theirId)
      if (theirSplit && Number(theirSplit.amount) > 0) {
        theirDebts.push({
          expenseId: e.id,
          title: e.title,
          date: e.date,
          remaining: toPaise(theirSplit.amount),
          originalAmount: Number(theirSplit.amount),
        })
      }
    }
  }

  // Sort oldest first
  myDebts.sort((a, b) => new Date(a.date) - new Date(b.date))
  theirDebts.sort((a, b) => new Date(a.date) - new Date(b.date))

  // Apply confirmed settlements FIFO
  const myPayments = settlements
    .filter(s => s.status === 'confirmed' && !s.deleted_at && s.payer_id === myId && s.payee_id === theirId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const theirPayments = settlements
    .filter(s => s.status === 'confirmed' && !s.deleted_at && s.payer_id === theirId && s.payee_id === myId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  applySettlementsFIFO(myPayments, myDebts)
  applySettlementsFIFO(theirPayments, theirDebts)

  return {
    myDebts: myDebts.filter(d => d.remaining > 0).map(d => ({
      expenseId: d.expenseId,
      title: d.title,
      date: d.date,
      amount: toRupees(d.remaining),
    })),
    theirDebts: theirDebts.filter(d => d.remaining > 0).map(d => ({
      expenseId: d.expenseId,
      title: d.title,
      date: d.date,
      amount: toRupees(d.remaining),
    })),
  }
}

function applySettlementsFIFO(payments, debts) {
  for (const s of payments) {
    let remaining = toPaise(s.amount)
    for (const d of debts) {
      if (remaining <= 0) break
      const apply = Math.min(remaining, d.remaining)
      d.remaining -= apply
      remaining -= apply
    }
  }
}
