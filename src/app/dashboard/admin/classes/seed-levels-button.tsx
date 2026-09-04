"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedPresetLevels } from "@/lib/classes-intelligence/actions";

export default function SeedLevelsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className="btn-primary min-h-11"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const err = await seedPresetLevels();
            if (err) {
              setError(err);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Création…" : "Créer les niveaux prédéfinis"}
      </button>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
