"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

const EXIT_MS = 180

function isInternalDashboardLink(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href")
  if (!href || href.startsWith("#")) return false
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")) return false

  const url = new URL(href, window.location.origin)
  return url.origin === window.location.origin && url.pathname.startsWith("/dashboard")
}

export function DashboardPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [exiting, setExiting] = useState(false)
  const pendingHref = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setExiting(false)
    pendingHref.current = null
    if (timer.current) clearTimeout(timer.current)
  }, [pathname])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a")
      if (!(anchor instanceof HTMLAnchorElement) || !isInternalDashboardLink(anchor)) return

      const url = new URL(anchor.href)
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return
      if (pendingHref.current) return

      event.preventDefault()
      pendingHref.current = url.href
      setExiting(true)

      timer.current = setTimeout(() => {
        const href = pendingHref.current
        pendingHref.current = null
        timer.current = null
        if (href) router.push(href)
      }, EXIT_MS)
    }

    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [router])

  return (
    <div className={`dashboard-page-transition ${exiting ? "is-exiting" : ""}`}>
      <div key={pathname} className="dashboard-page-transition-content">
        {children}
      </div>
      <div className="dashboard-page-transition-glow" aria-hidden="true" />
    </div>
  )
}
