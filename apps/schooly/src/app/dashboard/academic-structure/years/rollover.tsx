"use client"

/**
 * Page « Bascule » — autonome (placeholder).
 * Wrapper du panneau YearRolloverPanel. Le test du hub la lazy-load.
 */
import { useState, useEffect } from "react"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { YearRolloverPanel } from "../year-rollover-panel"

export default function RolloverPage() {
  const user = useSupabaseUser()
  void user
  return <YearRolloverPanel />
}