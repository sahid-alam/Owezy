export function throwIfOffline() {
  if (!navigator.onLine) throw new Error('OFFLINE')
}

export function getOnlineStatus() {
  return navigator.onLine
}

export function subscribeToOnline(cb) {
  const onOnline  = () => cb(true)
  const onOffline = () => cb(false)
  window.addEventListener('online',  onOnline)
  window.addEventListener('offline', onOffline)
  return () => {
    window.removeEventListener('online',  onOnline)
    window.removeEventListener('offline', onOffline)
  }
}
