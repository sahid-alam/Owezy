import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from './useAuth.js'
import {
  listSettlementsBetween,
  getSettlement,
  initiateSettlement as initiateSettlementFn,
  markAsPaid as markAsPaidFn,
  confirmSettlement as confirmSettlementFn,
  disputeSettlement as disputeSettlementFn,
} from '../lib/settlements.js'

export function useSettlementsBetween(friendId) {
  const { user } = useAuth()
  const userId = user?.id

  const query = useQuery({
    queryKey: ['settlements', 'between', userId, friendId],
    queryFn: () => listSettlementsBetween(userId, friendId),
    enabled: !!userId && !!friendId,
    staleTime: 30_000,
  })

  return { settlements: query.data ?? [], isLoading: query.isLoading }
}

export function useSettlement(settlementId) {
  const query = useQuery({
    queryKey: ['settlement', settlementId],
    queryFn: () => getSettlement(settlementId),
    enabled: !!settlementId,
    staleTime: 30_000,
  })

  return { settlement: query.data ?? null, isLoading: query.isLoading }
}

function useInvalidateBalances() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()

  return (friendId) => {
    queryClient.invalidateQueries({ queryKey: ['balances', userId] })
    queryClient.invalidateQueries({ queryKey: ['balance', userId, friendId] })
    queryClient.invalidateQueries({ queryKey: ['settlements', 'between', userId, friendId] })
  }
}

export function useInitiateAndPay() {
  const invalidate = useInvalidateBalances()

  return useMutation({
    mutationFn: async ({ payeeId, amount, note, groupId, tripId }) => {
      const id = await initiateSettlementFn({ payeeId, amount, note, groupId, tripId })
      await markAsPaidFn(id)
      return { id, payeeId }
    },
    onSuccess: ({ payeeId }) => {
      toast.success("Marked as paid — waiting for confirmation")
      invalidate(payeeId)
    },
    onError: (err) => {
      const msgs = {
        SELF_SETTLE:     "You can't settle with yourself",
        INVALID_AMOUNT:  "Amount must be greater than ₹0",
      }
      toast.error(msgs[err.message] ?? "Couldn't record payment — try again")
    },
  })
}

export function useConfirmSettlement(payerId) {
  const invalidate = useInvalidateBalances()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: confirmSettlementFn,
    onSuccess: (_, settlementId) => {
      toast.success("Payment confirmed")
      invalidate(payerId)
      queryClient.invalidateQueries({ queryKey: ['settlement', settlementId] })
    },
    onError: () => toast.error("Couldn't confirm — try again"),
  })
}

export function useDisputeSettlement(payerId) {
  const invalidate = useInvalidateBalances()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: disputeSettlementFn,
    onSuccess: (_, settlementId) => {
      toast.success("Disputed — ask them to try again")
      invalidate(payerId)
      queryClient.invalidateQueries({ queryKey: ['settlement', settlementId] })
    },
    onError: () => toast.error("Couldn't dispute — try again"),
  })
}
