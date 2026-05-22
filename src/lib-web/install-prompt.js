let _deferredPrompt = null

export function capturePrompt(onCaptured) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _deferredPrompt = e
    if (onCaptured) onCaptured()
  })
  window.addEventListener('appinstalled', () => {
    markInstalled()
    _deferredPrompt = null
  })
}

export function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function isIosSafari() {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) &&
    /WebKit/.test(navigator.userAgent) &&
    !/(CriOS|FxiOS|OPiOS|mercury)/.test(navigator.userAgent)
  )
}

export function incrementSessionCount() {
  if (sessionStorage.getItem('session_counted')) return
  sessionStorage.setItem('session_counted', '1')
  const count = Number(localStorage.getItem('session_count') || '0') + 1
  localStorage.setItem('session_count', String(count))
}

function getSessionCount() {
  return Number(localStorage.getItem('session_count') || '0')
}

function isAndroidDismissedRecently() {
  const at = localStorage.getItem('install_dismissed_at')
  if (!at) return false
  return Date.now() - Number(at) < 30 * 24 * 60 * 60 * 1000
}

export function shouldShowBanner() {
  if (isInstalled()) return false
  if (isAndroidDismissedRecently()) return false
  if (getSessionCount() < 3) return false
  return !!_deferredPrompt
}

export function iosBannerShouldShow() {
  if (!isIosSafari()) return false
  if (isInstalled()) return false
  if (localStorage.getItem('ios_install_dismissed')) return false
  return getSessionCount() >= 3
}

export async function showInstallPrompt() {
  if (!_deferredPrompt) return null
  _deferredPrompt.prompt()
  const { outcome } = await _deferredPrompt.userChoice
  _deferredPrompt = null
  return outcome
}

export function markDismissed() {
  localStorage.setItem('install_dismissed_at', String(Date.now()))
}

export function markIosDismissed() {
  localStorage.setItem('ios_install_dismissed', '1')
}

export function markInstalled() {
  localStorage.removeItem('install_dismissed_at')
  localStorage.setItem('pwa_installed', '1')
}
