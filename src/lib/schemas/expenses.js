import { z } from 'zod'

export const CATEGORIES = [
  'food', 'transport', 'accommodation', 'entertainment',
  'groceries', 'shopping', 'utilities', 'other',
]

export const CATEGORY_LABELS = {
  food: 'Food & Drink',
  transport: 'Transport',
  accommodation: 'Stay',
  entertainment: 'Entertainment',
  groceries: 'Groceries',
  shopping: 'Shopping',
  utilities: 'Utilities',
  other: 'Other',
}

export const expenseFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Max 100 characters'),
  amount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Enter a valid amount'),
  paid_by: z.string().uuid('Select who paid'),
  category: z.enum(CATEGORIES).optional().or(z.literal('')),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().trim().max(500, 'Max 500 characters').optional().or(z.literal('')),
  split_type: z.enum(['equal', 'custom']),
})
