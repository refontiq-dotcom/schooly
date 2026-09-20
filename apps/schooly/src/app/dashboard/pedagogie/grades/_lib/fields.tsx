// apps/schooly/src/app/dashboard/pedagogie/grades/_lib/fields.tsx
// Champs partagés par les écrans « Notes » et « Bulletins » (DRY : les trois
// écrans du module avaient chacun leur copie du `<select>` stylé).
import type { ReactNode, SelectHTMLAttributes } from "react"

/** Contrôle natif pour les formulaires : options, required et FormData. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      {children}
    </label>
  )
}

/** Sélecteur classique « Choisir… » alimenté par une liste { id, label }. */
export function SelectField({
  label,
  name,
  options,
  required = false,
}: {
  label: string
  name: string
  options: Array<{ id: string; label: string }>
  required?: boolean
}) {
  return (
    <Field label={label}>
      <Select name={name} required={required} defaultValue="">
        <option value="">Choisir</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </Select>
    </Field>
  )
}
