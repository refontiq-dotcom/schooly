"use client"

import { useEffect } from "react"

/**
 * Enregistre le service worker (mode hors-ligne PWA) une seule fois.
 * Ignoré silencieusement en développement si sw.js n'est pas servi.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    const onLoaded = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* pas bloquant : l'app fonctionne aussi en ligne seule */
      })
    }
    if (document.readyState === "complete") onLoaded()
    else window.addEventListener("load", onLoaded)
    return () => window.removeEventListener("load", onLoaded)
  }, [])

  return null
}
