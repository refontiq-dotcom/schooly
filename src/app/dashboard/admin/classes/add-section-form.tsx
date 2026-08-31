"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddSectionForm({ levelId }: { levelId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(30);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || capacity <= 0) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("sections").insert({ level_id: levelId, name: name.trim(), capacity });
    setLoading(false);
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="text-xs text-slate-500">Nom de la section</label>
        <input
          className="input"
          placeholder="Ex: 6ème1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-slate-500">Capacité</label>
        <input
          type="number"
          min={1}
          className="input w-28"
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
      </div>
      <button type="submit" disabled={loading} className="btn-secondary whitespace-nowrap">
        + Ajouter la section
      </button>
    </form>
  );
}
