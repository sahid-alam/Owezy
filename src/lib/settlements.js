import { supabase } from './supabase.js'

const SETTLEMENT_SELECT = `
  id, amount, note, status, payer_id, payee_id, group_id, trip_id,
  created_at, paid_at, confirmed_at, deleted_at,
  payer:profiles!payer_id(id, name, avatar_url, upi_id),
  payee:profiles!payee_id(id, name, avatar_url, upi_id)
`

export async function initiateSettlement({ payeeId, amount, note, groupId, tripId }) {
  const { data, error } = await supabase.rpc('initiate_settlement', {
    p_payee_id: payeeId,
    p_amount:   Number(amount),
    p_note:     note || null,
    p_group_id: groupId || null,
    p_trip_id:  tripId || null,
  })
  if (error) throw error
  return data  // uuid
}

export async function markAsPaid(settlementId) {
  const { error } = await supabase.rpc('mark_settlement_paid', {
    p_settlement_id: settlementId,
  })
  if (error) throw error
}

export async function confirmSettlement(settlementId) {
  const { error } = await supabase.rpc('confirm_settlement', {
    p_settlement_id: settlementId,
  })
  if (error) throw error
}

export async function disputeSettlement(settlementId) {
  const { error } = await supabase.rpc('dispute_settlement', {
    p_settlement_id: settlementId,
  })
  if (error) throw error
}

export async function listSettlementsBetween(myId, friendId) {
  const { data, error } = await supabase
    .from('settlements')
    .select(SETTLEMENT_SELECT)
    .or(`and(payer_id.eq.${myId},payee_id.eq.${friendId}),and(payer_id.eq.${friendId},payee_id.eq.${myId})`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getSettlement(settlementId) {
  const { data, error } = await supabase
    .from('settlements')
    .select(SETTLEMENT_SELECT)
    .eq('id', settlementId)
    .single()
  if (error) throw error
  return data
}
