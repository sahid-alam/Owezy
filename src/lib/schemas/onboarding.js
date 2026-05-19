import { z } from 'zod'

export const nameSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Keep it under 50 characters'),
})

export const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{9,14}$/, 'Enter your number with country code, e.g. +919876543210'),
})

export const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

export const upiSchema = z.object({
  upi_id: z
    .string()
    .trim()
    .regex(/^[\w.\-]+@[\w.\-]+$/, 'Looks like a UPI ID should be name@bank'),
})
