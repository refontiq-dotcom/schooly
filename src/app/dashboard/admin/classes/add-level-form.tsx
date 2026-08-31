"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddLevelForm({ establishmentId }: { establishmentId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("levels").insert({ establishment_id: establishmentId, name: name.trim() });
    setLoading(false);
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        className="input"
        placeholder="Ex: 6ème"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
        + Ajouter le niveau
      </button>
    </form>
  );
}
