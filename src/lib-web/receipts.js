// Browser-only receipt storage helpers.
// Do NOT import this from src/lib/ — it depends on supabase client and browser APIs.

import { supabase } from '../lib/supabase.js'
import { compressImage } from './compress-image.js'

/**
 * Compress + upload a receipt image to the private receipts bucket.
 * Path: {userId}/draft-{timestamp}.jpg — stored permanently on the expense row.
 * @param {File} file
 * @param {string} userId
 * @returns {Promise<string>} storage path (NOT a signed URL)
 */
export async function uploadDraftReceipt(file, userId) {
  const blob = await compressImage(file, 1024, 0.8)
  const path = `${userId}/draft-${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('receipts')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

/**
 * Generate a 1-hour signed URL for displaying a receipt thumbnail.
 * Called fresh on each render — never stored in the expense row.
 * @param {string} storagePath
 * @returns {Promise<string>} signed URL, or null if generation fails
 */
export async function getDraftSignedUrl(storagePath) {
  if (!storagePath) return null
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(storagePath, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}
