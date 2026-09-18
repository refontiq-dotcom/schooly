// app/api/v1/public/finance/syscohada/helpers.ts
// Helpers purs réutilisables par la route ET les tests.
// Aucun import côté serveur (createClient / NextResponse) → importable en test.

const SCHOOL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_FORMATS = ["general", "analytic", "sage", "csv"] as const

export function isValidSchoolId(id: string): boolean {
  return SCHOOL_UUID_RE.test(id)
}

export function isValidFormat(f: string): f is (typeof VALID_FORMATS)[number] {
  return VALID_FORMATS.includes(f as (typeof VALID_FORMATS)[number])
}

export function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(n)
}

export function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const lines = [headers.map(esc).join(" ; ")]
  for (const row of rows) lines.push(headers.map((h) => esc(row[h])).join(" ; "))
  return lines.join("\n")
}
