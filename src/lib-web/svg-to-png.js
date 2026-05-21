export async function svgToPng(svgString, width = 1080, height = 1080) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const img  = await new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height
  canvas.getContext('2d').drawImage(img, 0, 0, width, height)
  URL.revokeObjectURL(url)
  return new Promise(res => canvas.toBlob(res, 'image/png'))
}
