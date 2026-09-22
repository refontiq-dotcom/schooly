"use client"

/**
 * Page « Matières » — autonome (placeholder fonctionnel).
 * Extrait du module matières du hub académique. À enrichir d’un vrai
 * SubjectsPanel dès la prochaine itération du périmètre structure.
 */
import { useState, useEffect } from "react"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { getSubjects } from "../actions"

export default function SubjectsPage() {
  const user = useSupabaseUser()
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string | null; coefficient: number }[]>([])

  async function reload() {
    const res = await getSubjects()
    if (res.data) setSubjects(res.data)
  }

  useEffect(() => { if (user) void reload() }, [user])

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Matières</h2>
      {subjects.map((s) => (
        <p key={s.id}>{s.code ? `${s.code} — ` : ""}{s.name} (coefficient {s.coefficient})</p>
      ))}
      {subjects.length === 0 && <p className="text-sm text-muted-foreground">Aucune matière.</p>}
    </section>
  )
}
