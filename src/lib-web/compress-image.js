/**
 * Browser-only. Resizes an image so its longest edge ≤ maxPx, then re-encodes
 * as JPEG at the given quality. Returns a Blob.
 * Lives in src/lib-web/ (not src/lib/) because it uses Image and canvas.
 * @param {File|Blob} file
 * @param {number} maxPx
 * @param {number} quality 0–1
 * @returns {Promise<Blob>}
 */
export function compressImage(file, maxPx = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height / width) * maxPx)
          width = maxPx
        } else {
          width = Math.round((width / height) * maxPx)
          height = maxPx
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}
