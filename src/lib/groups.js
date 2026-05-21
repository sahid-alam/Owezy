import { supabase } from './supabase.js'

const MEMBER_SELECT = `
  id, group_id, profile_id, role, joined_at,
  profile:profiles!profile_id(id, name, avatar_url)
`

export async function createGroup(_userId, { name, description }) {
  const { data, error } = await supabase.rpc('create_group', {
    p_name: name.trim(),
    p_description: description?.trim() || null,
  })
  if (error) throw error
  return { id: data }
}

export async function listMyGroups(userId, { archived = false } = {}) {
  let query = supabase
    .from('groups')
    .select('id, name, description, archived_at, updated_at, created_by')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  query = archived
    ? query.not('archived_at', 'is', null)
    : query.is('archived_at', null)

  const { data: groups, error } = await query
  if (error) throw error
  if (!groups || groups.length === 0) return []

  const groupIds = groups.map(g => g.id)
  const { data: memberships, error: mErr } = await supabase
    .from('group_members')
    .select('group_id, profile_id, role')
    .in('group_id', groupIds)
    .is('deleted_at', null)
  if (mErr) throw mErr

  const countMap = {}
  const roleMap = {}
  for (const row of memberships) {
    countMap[row.group_id] = (countMap[row.group_id] || 0) + 1
    if (row.profile_id === userId) roleMap[row.group_id] = row.role
  }

  return groups.map(g => ({
    ...g,
    memberCount: countMap[g.id] || 0,
    callerRole: roleMap[g.id] || null,
  }))
}

export async function getGroup(groupId) {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, description, archived_at, created_by, created_at, updated_at')
    .eq('id', groupId)
    .single()
  if (error) throw error
  return data
}

export async function updateGroup(groupId, patch) {
  const update = {}
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.description !== undefined) update.description = patch.description?.trim() || null
  const { error } = await supabase.from('groups').update(update).eq('id', groupId)
  if (error) throw error
}

export async function archiveGroup(groupId) {
  const { error } = await supabase
    .from('groups')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', groupId)
  if (error) throw error
}

export async function listMembers(groupId) {
  const { data, error } = await supabase
    .from('group_members')
    .select(MEMBER_SELECT)
    .eq('group_id', groupId)
    .is('deleted_at', null)
  if (error) throw error

  return (data || []).sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
    return (a.profile?.name || '').localeCompare(b.profile?.name || '')
  })
}

export async function addMemberByProfile(groupId, profileId) {
  const { error } = await supabase.rpc('add_group_member', {
    p_group_id: groupId,
    p_profile_id: profileId,
  })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('NOT_ADMIN')) throw new Error('NOT_ADMIN')
    if (msg.includes('ALREADY_MEMBER')) throw new Error('ALREADY_MEMBER')
    throw error
  }
}

export async function removeMember(groupId, profileId) {
  const { error } = await supabase
    .from('group_members')
    .update({ left_at: new Date().toISOString(), deleted_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
  if (error) throw error
}

export async function promoteToAdmin(groupId, profileId) {
  const { error } = await supabase
    .from('group_members')
    .update({ role: 'admin' })
    .eq('group_id', groupId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
  if (error) throw error
}

export async function demoteFromAdmin(groupId, profileId) {
  const { error } = await supabase
    .from('group_members')
    .update({ role: 'member' })
    .eq('group_id', groupId)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
  if (error) throw error
}

export async function leaveGroup(groupId) {
  const { error } = await supabase.rpc('leave_group', { p_group_id: groupId })
  if (error) {
    const msg = error.message || ''
    if (msg.includes('LAST_ADMIN')) throw new Error('LAST_ADMIN')
    if (msg.includes('NOT_A_MEMBER')) throw new Error('NOT_A_MEMBER')
    throw error
  }
}
