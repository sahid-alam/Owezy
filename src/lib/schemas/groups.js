import { z } from 'zod'

export const groupNameSchema = z.string().trim().min(1, 'Name is required').max(50, 'Max 50 characters')
export const groupDescriptionSchema = z.string().trim().max(200, 'Max 200 characters').optional().or(z.literal(''))
export const groupFormSchema = z.object({
  name: groupNameSchema,
  description: groupDescriptionSchema,
})
