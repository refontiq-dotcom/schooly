"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Bell, CheckCheck, Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/browser"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Notification = {
  id: string
  type: string
  title: string
  message: string
  href: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const [{ data: rows }, { data: summary }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id,type,title,message,href,entity_id,read_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase.rpc("get_notification_summary"),
    ])

    setNotifications((rows ?? []) as Notification[])
    setUnreadCount(Number(summary?.[0]?.unread_count ?? 0))
    setLoading(false)
  }, [])

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null
    let mounted = true

    const start = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return

      await load()
      channel = supabase
        .channel(`schooly-notifications-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => {
            if (mounted) void load()
          },
        )
        .subscribe()
    }

    void start()
    return () => {
      mounted = false
      if (channel) {
        const supabase = createClient()
        void supabase.removeChannel(channel)
      }
    }
  }, [load])

  const markRead = async (id: string) => {
    const supabase = createClient()
    await supabase.rpc("mark_notification_read", { p_notification_id: id })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    if (unreadCount === 0) return
    const supabase = createClient()
    await supabase.rpc("mark_all_notifications_read")
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    setUnreadCount(0)
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative rounded-full"
        aria-label={unreadCount ? `${unreadCount} notification(s) non lue(s)` : "Notifications"}
        onClick={() => setOpen(value => !value)}
      >
        <Bell className={cn("h-4 w-4", unreadCount > 0 && "animate-pulse")} />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,390px)] overflow-hidden rounded-2xl border bg-background/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount ? `${unreadCount} non lue(s)` : "Tout est lu"}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Tout lire
            </Button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </div>
            ) : notifications.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Aucune notification.</p>
            ) : (
              notifications.map(notification => {
                const content = (
                  <div className={cn("border-b px-4 py-3 transition-colors hover:bg-muted/50", !notification.read_at && "bg-primary/5")}>
                    <div className="flex gap-3">
                      <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", notification.read_at ? "bg-muted" : "bg-primary")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{notification.title}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{notification.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(notification.created_at)}</p>
                      </div>
                    </div>
                  </div>
                )

                if (notification.href) {
                  return (
                    <Link
                      key={notification.id}
                      href={notification.href}
                      onClick={() => {
                        if (!notification.read_at) void markRead(notification.id)
                        setOpen(false)
                      }}
                    >
                      {content}
                    </Link>
                  )
                }

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className="block w-full text-left"
                    onClick={() => void markRead(notification.id)}
                  >
                    {content}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
