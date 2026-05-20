import { z } from 'zod'
import { normalizePhone } from '../phone-format.js'

export const friendSearchSchema = z.object({
  query: z.string().trim().min(1, 'Enter a name or phone number').max(50),
})

export const phoneInviteSchema = z.object({
  phone: z.string().refine(
    (val) => normalizePhone(val) !== null,
    'Enter a valid number like 9876543210 or +919876543210',
  ),
})
