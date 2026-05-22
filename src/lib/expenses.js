import { supabase } from './supabase.js'

const SPLIT_SELECT = `
  id, expense_id, profile_id, guest_id, amount, deleted_at,
  profile:profiles!profile_id(id, name, avatar_url)
`

const EXPENSE_SELECT = `
  id, title, amount, paid_by, group_id, trip_id, category,
  date, notes, split_type, ai_parsed, receipt_path, created_by, deleted_at, created_at, updated_at,
  payer:profiles!paid_by(id, name, avatar_url),
  creator:profiles!created_by(id, name, avatar_url),
  splits:expense_splits(${SPLIT_SELECT})
`

export async function listGroupExpenses(groupId) {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('group_id', groupId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalise)
}

export async function listFriendExpenses(myId, friendId) {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .is('group_id', null)
    .is('trip_id', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  // Keep only expenses where both parties have active splits
  return (data || [])
    .map(normalise)
    .filter(e => {
      const ids = e.splits.filter(s => !s.deleted_at).map(s => s.profile_id)
      return ids.includes(myId) && ids.includes(friendId)
    })
}

export async function getExpense(expenseId) {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', expenseId)
    .single()
  if (error) throw error
  return normalise(data)
}

export async function getExpenseAuditLog(expenseId) {
  const { data, error } = await supabase
    .from('expense_audit_log')
    .select(`
      id, expense_id, edited_by, action, changes, created_at,
      editor:profiles!edited_by(id, name, avatar_url)
    `)
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createExpense({
  title, amount, paidBy, groupId, tripId,
  category, date, notes, splitType, splits,
  aiParsed = false, receiptPath = null,
}) {
  const { data, error } = await supabase.rpc('create_expense', {
    p_title:        title.trim(),
    p_amount:       Number(amount),
    p_paid_by:      paidBy,
    p_group_id:     groupId || null,
    p_trip_id:      tripId || null,
    p_category:     category || null,
    p_date:         date,
    p_notes:        notes || null,
    p_split_type:   splitType,
    p_splits:       splits,
    p_ai_parsed:    aiParsed,
    p_receipt_path: receiptPath || null,
  })
  if (error) throw error
  return data  // uuid of new expense
}

export async function updateExpense(expenseId, patch, newSplits) {
  const { error } = await supabase.rpc('update_expense', {
    p_expense_id: expenseId,
    p_patch:      patch,
    p_new_splits: newSplits || null,
  })
  if (error) throw error
}

export async function addExpenseParticipants(expenseId, newProfileIds, newSplits) {
  const { error } = await supabase.rpc('add_expense_participants', {
    p_expense_id:      expenseId,
    p_new_profile_ids: newProfileIds,
    p_new_splits:      newSplits,
  })
  if (error) throw error
}

export async function softDeleteExpense(expenseId) {
  const { error } = await supabase.rpc('soft_delete_expense', {
    p_expense_id: expenseId,
  })
  if (error) throw error
}

function normalise(e) {
  return {
    ...e,
    splits: (e.splits || []).filter(s => !s.deleted_at),
  }
}
