import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase.js'
import { getActiveFriendship, unfriend, blockFriend } from '../../lib/friends.js'
import { useAuth } from '../../hooks/useAuth.js'

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function FriendDetail() {
  const { friendId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  const profileQuery = useQuery({
    queryKey: ['profile', friendId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, upi_id, phone')
        .eq('id', friendId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!friendId,
  })

  const friendshipQuery = useQuery({
    queryKey: ['friendship', userId, friendId],
    queryFn: () => getActiveFriendship(userId, friendId),
    enabled: !!userId && !!friendId,
  })

  function invalidateLists() {
    queryClient.invalidateQueries({ queryKey: ['friends', userId] })
    queryClient.invalidateQueries({ queryKey: ['friendships', 'all-active', userId] })
  }

  const unfriendMutation = useMutation({
    mutationFn: () => unfriend(friendshipQuery.data.id),
    onSuccess: () => {
      invalidateLists()
      navigate('/friends')
    },
    onError: () => toast.error("Couldn't remove friend — try again"),
  })

  const blockMutation = useMutation({
    mutationFn: () => blockFriend(friendshipQuery.data.id),
    onSuccess: () => {
      invalidateLists()
      navigate('/friends')
    },
    onError: () => toast.error("Couldn't block — try again"),
  })

  if (profileQuery.isLoading || friendshipQuery.isLoading) return <Spinner />
  if (!profileQuery.data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-400">Friend not found.</p>
      </div>
    )
  }

  const friend = profileQuery.data
  const friendship = friendshipQuery.data
  const initials = friend.name
    ? friend.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-indigo-600 font-medium"
        >
          ← Back
        </button>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center py-8 px-6 gap-3">
        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
          {friend.avatar_url
            ? <img src={friend.avatar_url} alt={friend.name} className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-indigo-700">{initials}</span>
          }
        </div>
        <h2 className="text-xl font-bold text-gray-900">{friend.name}</h2>
        {friend.upi_id && (
          <p className="text-sm text-gray-400">{friend.upi_id}</p>
        )}
      </div>

      {/* Placeholder */}
      <div className="mx-4 p-4 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-400 text-center">
          Expenses and balances coming in the next update
        </p>
      </div>

      {/* Actions — only shown when an active friendship exists */}
      {friendship && friendship.status === 'accepted' && (
        <div className="mt-6 border-t border-gray-100">
          <button
            disabled={unfriendMutation.isPending}
            onClick={() => unfriendMutation.mutate()}
            className="w-full px-4 py-4 text-sm text-red-500 text-left hover:bg-red-50 disabled:opacity-50"
          >
            {unfriendMutation.isPending ? 'Removing…' : 'Remove friend'}
          </button>
          <div className="border-t border-gray-100" />
          <button
            disabled={blockMutation.isPending}
            onClick={() => blockMutation.mutate()}
            className="w-full px-4 py-4 text-sm text-red-500 text-left hover:bg-red-50 disabled:opacity-50"
          >
            {blockMutation.isPending ? 'Blocking…' : 'Block'}
          </button>
        </div>
      )}
    </div>
  )
}
