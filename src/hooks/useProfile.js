import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyProfile, updateMyProfile, uploadAvatar as libUploadAvatar, removeAvatar as libRemoveAvatar } from '../lib/profile.js'
import { compressImage } from '../lib-web/compress-image.js'
import { useAuth } from './useAuth.js'

export function useProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getMyProfile(user.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  })

  async function updateProfile(patch) {
    await updateMyProfile(user.id, patch)
    await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
  }

  async function uploadAvatar(file) {
    const blob = await compressImage(file)
    const url = await libUploadAvatar(blob, user.id)
    await updateProfile({ avatar_url: url })
    return url
  }

  async function removeAvatar() {
    await libRemoveAvatar(user.id)
    await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
  }

  return { profile: profile ?? null, isLoading, updateProfile, uploadAvatar, removeAvatar }
}
