import { useState, useEffect } from 'react'
import {
  capturePrompt,
  shouldShowBanner,
  iosBannerShouldShow,
  showInstallPrompt,
  markDismissed,
  markIosDismissed,
  markInstalled,
} from '../lib-web/install-prompt.js'

export function useInstallPrompt() {
  const [show,    setShow]    = useState(false)
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    // Capture the deferred prompt; re-evaluate banner eligibility when it arrives
    capturePrompt(() => setShow(shouldShowBanner()))

    // Evaluate on mount (captures already-fired events in some browsers)
    setShow(shouldShowBanner())
    setShowIos(iosBannerShouldShow())
  }, [])

  async function install() {
    const outcome = await showInstallPrompt()
    if (outcome === 'accepted') {
      markInstalled()
      setShow(false)
    }
  }

  function dismiss() {
    markDismissed()
    setShow(false)
  }

  function dismissIos() {
    markIosDismissed()
    setShowIos(false)
  }

  return { show, showIos, install, dismiss, dismissIos }
}
