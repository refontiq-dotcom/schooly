"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/browser"

export function useSupabaseUser() {
  const [user, setUser] = useState<{ id: string; role?: string; user_metadata?: any } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!cancelled) {
        setUser(user ? { id: user.id, role: user.role, user_metadata: user.user_metadata } : null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return user
}
