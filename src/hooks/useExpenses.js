import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from './useAuth.js'
import {
  listGroupExpenses,
  listFriendExpenses,
  getExpense,
  getExpenseAuditLog,
  createExpense as createExpenseFn,
  updateExpense as updateExpenseFn,
  softDeleteExpense as softDeleteExpenseFn,
} from '../lib/expenses.js'

export function useGroupExpenses(groupId) {
  const query = useQuery({
    queryKey: ['expenses', 'group', groupId],
    queryFn: () => listGroupExpenses(groupId),
    enabled: !!groupId,
    staleTime: 30_000,
  })
  return { expenses: query.data ?? [], isLoading: query.isLoading }
}

export function useFriendExpenses(friendId) {
  const { user } = useAuth()
  const userId = user?.id
  const query = useQuery({
    queryKey: ['expenses', 'friend', userId, friendId],
    queryFn: () => listFriendExpenses(userId, friendId),
    enabled: !!userId && !!friendId,
    staleTime: 30_000,
  })
  return { expenses: query.data ?? [], isLoading: query.isLoading }
}

export function useExpense(expenseId) {
  const query = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => getExpense(expenseId),
    enabled: !!expenseId,
    staleTime: 30_000,
  })
  return { expense: query.data ?? null, isLoading: query.isLoading }
}

export function useExpenseAudit(expenseId) {
  const query = useQuery({
    queryKey: ['expense-audit', expenseId],
    queryFn: () => getExpenseAuditLog(expenseId),
    enabled: !!expenseId,
    staleTime: 60_000,
  })
  return { entries: query.data ?? [], isLoading: query.isLoading }
}

export function useCreateExpense() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createExpenseFn,
    onSuccess: (_, vars) => {
      toast.success('Expense added')
      if (vars.groupId) {
        queryClient.invalidateQueries({ queryKey: ['expenses', 'group', vars.groupId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['expenses', 'friend', userId] })
      }
    },
    onError: (err) => {
      const msgs = {
        PAYER_NOT_IN_SPLITS: "The payer must be included in the split",
        SPLIT_SUM_MISMATCH:  "Split amounts don't add up to the total",
        NOT_GROUP_MEMBER:    "You're not a member of this group",
      }
      toast.error(msgs[err.message] ?? "Couldn't save expense — try again")
    },
  })
}

export function useUpdateExpense(expenseId) {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ patch, newSplits }) => updateExpenseFn(expenseId, patch, newSplits),
    onSuccess: (_, vars) => {
      toast.success('Expense updated')
      queryClient.invalidateQueries({ queryKey: ['expense', expenseId] })
      queryClient.invalidateQueries({ queryKey: ['expense-audit', expenseId] })
      // Broad invalidation — we don't know context here
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (err) => {
      const msgs = {
        NOT_CREATOR:        "Only the creator can edit this expense",
        SPLIT_SUM_MISMATCH: "Split amounts don't add up to the total",
      }
      toast.error(msgs[err.message] ?? "Couldn't update — try again")
    },
  })
}

export function useSoftDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: softDeleteExpenseFn,
    onSuccess: () => {
      toast.success('Expense removed')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense'] })
    },
    onError: () => toast.error("Couldn't remove expense — try again"),
  })
}
