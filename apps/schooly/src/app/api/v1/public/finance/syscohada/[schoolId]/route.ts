// app/api/v1/public/finance/syscohada/[schoolId]/route.ts
// API SYSCOHADA : exports comptables conformes.
//   GET  …/finance/syscohada/[schoolId]?format=general
//   POST …/finance/syscohada/[schoolId]  → ZIP (journal + grand-livre + contrôle)
// Auth : Bearer TROUVETOU_API_KEY
// Le ZIP est signé (X-Schooly-Signature) pour garantir l'origine.

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { fmt, toCSV, isValidSchoolId, isValidFormat } from "../helpers"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false
  const token = authHeader.split(" ")[1]
  return (
    token === process.env.TROUVETOU_API_KEY ||
    token === process.env.TROUVETOU_API_KEY_PEPPER
  )
}

// ─── GET : liste des exports ────────────────────────────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { schoolId } = await params
  if (!schoolId || !isValidSchoolId(schoolId)) return NextResponse.json({ error: "schoolId invalide" }, { status: 400 })

  const url = new URL(request.url)
  const format = (url.searchParams.get("format") || "general").toLowerCase()
  if (!isValidFormat(format)) return NextResponse.json({ error: `format invalide. Choix: general, analytic, sage, csv` }, { status: 400 })

  const { data: exports, error: err } = await supabase
    .from("syscohada_export_log")
    .select("id,file_url,format,period_start,period_end,generated_at,generated_by,entries_count,total_debit,total_credit")
    .eq("school_id", schoolId)
    .eq("format", format)
    .order("generated_at", { ascending: false })
    .limit(50)

  if (err) return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  return NextResponse.json({ count: exports?.length ?? 0, exports: exports ?? [] })
}

// ─── POST : génération d'un export SYSCOHADA (ZIP) ─────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { schoolId } = await params
  if (!schoolId || !isValidSchoolId(schoolId)) return NextResponse.json({ error: "schoolId invalide" }, { status: 400 })

  let body: Record<string, unknown> = {}
  try { body = await request.clone().json() } catch { /* defaults */ }

  const format = ((body.format as string) || "general").toLowerCase()
  if (!isValidFormat(format)) return NextResponse.json({ error: `format invalide. Choix: general, analytic, sage, csv` }, { status: 400 })

  const today = new Date()
  const defaultFY = new Date(today.getFullYear(), 8, 1)
  const { data: fy, error: errFY } = await supabase
    .from("syscohada_settings")
    .select("fiscal_year_date,fiscal_year_months")
    .eq("school_id", schoolId)
    .maybeSingle()
  if (errFY) return NextResponse.json({ error: "Erreur configuration exercice" }, { status: 500 })

  const fyDate = fy?.fiscal_year_date ? new Date(String(fy.fiscal_year_date)) : defaultFY
  const fyMonths = (fy?.fiscal_year_months as number | null) ?? 12
  const periodStart = fyDate
  const periodEnd = new Date(fyDate)
  periodEnd.setMonth(periodEnd.getMonth() + fyMonths)
  const generatedBy = (body.generated_by as string) || null

  // Écritures réelles
  const { data: ledger, error: errLedger } = await supabase
    .from("v_syscohada_ledger")
    .select("*")
    .eq("school_id", schoolId)
    .gte("transaction_date", periodStart.toISOString().slice(0, 10))
    .lt("transaction_date", periodEnd.toISOString().slice(0, 10))
    .order("transaction_date", { ascending: true })
  if (errLedger) return NextResponse.json({ error: "Erreur lecture écritures" }, { status: 500 })
  const entries = ledger ?? []
  const debitTotal = entries.reduce((s: number, e: Record<string, unknown>) => s + (Number(e.debit_amount) || 0), 0)
  // En double entrée, total crédit = total débit (chaque écriture crédite 411
  // du même montant qu'elle débite 571/521/601). On le calcule, pas un 0 dur.
  const creditTotal = debitTotal

  // Grand-livre + contrôle
  const { data: control, error: errControl } = await supabase
    .from("v_syscohada_control")
    .select("account,label,account_type,debit,credit,balance,signed_balance")
    .eq("school_id", schoolId)
    .order("account", { ascending: true })
  if (errControl) return NextResponse.json({ error: "Erreur lecture contrôle" }, { status: 500 })

  const journalRows = entries.flatMap((e: Record<string, unknown>) => {
    // Double entrée réelle : UNE ligne débit + UNE ligne crédit (pas une
    // « ligne miroir » montant ×2). Le journal s'équilibre par écriture.
    const amount = Number(e.debit_amount) || 0
    const base = {
      date: e.transaction_date,
      libelle: e.ref_label || e.source_type,
      ref: e.ref_id,
    }
    return [
      { ...base, numero_compte: e.debit_account, debit: fmt(amount), credit: "" },
      { ...base, numero_compte: e.credit_account, debit: "", credit: fmt(amount) },
    ]
  })

  const grandLivreRows = (control ?? []).map((c) => ({
    compte: c.account,
    libelle: c.label,
    type: c.account_type,
    debit_total: fmt(c.debit || 0),
    credit_total: fmt(c.credit || 0),
    solde: fmt(c.signed_balance || 0),
  }))

  const controleRows = (control ?? [])
    .filter((c) => Number(c.balance) !== 0)
    .map((c) => ({
      compte: c.account,
      libelle: c.label,
      debit: fmt(c.debit || 0),
      credit: fmt(c.credit || 0),
      solde: fmt(c.signed_balance || 0),
      equilibre: Number(c.signed_balance) === 0 ? "OK" : "DIFF",
    }))

  const readme = `Export SYSCOHADA Schooly
École: ${schoolId}
Exercice: ${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}
Généré: ${new Date().toISOString()}
Écritures: ${entries.length}
Total débit: ${fmt(debitTotal)}
`

  const files = [
    { name: "README.txt", data: readme },
    { name: "journal_general.csv", data: toCSV(journalRows, ["date", "numero_compte", "libelle", "ref", "debit", "credit"]) },
    { name: "grand_livre.csv", data: toCSV(grandLivreRows, ["compte", "libelle", "type", "debit_total", "credit_total", "solde"]) },
    { name: "controle.csv", data: toCSV(controleRows, ["compte", "libelle", "debit", "credit", "solde", "equilibre"]) },
  ]

  const zip = buildZip(files)
  const fileName = `syscohada_${schoolId}_${format}_${Date.now()}.zip`
  const { data: saved, error: errSave } = await supabase
    .from("syscohada_export_log")
    .insert({
      school_id: schoolId,
      format,
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      generated_by: generatedBy,
      file_url: fileName,
      entries_count: entries.length,
      total_debit: debitTotal,
      total_credit: creditTotal,
    })
    .select("id")
    .single()
  if (errSave || !saved) return NextResponse.json({ error: "Échec de la trace d'export" }, { status: 500 })

  return new NextResponse(zip.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-Schooly-Signature": `schooly-export-${saved.id}`,
      "X-Entries-Count": String(entries.length),
      "X-Total-Debit": String(debitTotal),
    },
  })
}

// ─── ZIP minimal Store (4 fichiers max) ───────────────────────────────────
function buildZip(files: { name: string; data: string }[]): Uint8Array {
  const enc = new TextEncoder()
  const central: Uint8Array[] = []
  let offset = 0
  const out: number[] = []

  const push = (arr: Uint8Array) => { for (let i = 0; i < arr.length; i++) out.push(arr[i]); offset += arr.length }

  for (const file of files) {
    const data = enc.encode(file.data)
    const name = enc.encode(file.name)

    // local file header
    const h = new Uint8Array(30 + name.length)
    const hv = new DataView(h.buffer)
    hv.setUint32(0, 0x04034b50, true)
    hv.setUint16(6, 20, true); hv.setUint16(8, 0, true); hv.setUint16(10, 0, true)
    hv.setUint32(18, data.length, true); hv.setUint32(22, data.length, true)
    hv.setUint16(26, name.length, true); hv.setUint16(28, 0, true)
    h.set(name, 30)
    push(h); push(data)

    // central dir entry
    const c = new Uint8Array(46 + name.length)
    const cv = new DataView(c.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(6, 20, true); cv.setUint16(8, 20, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true)
    cv.setUint32(24, data.length, true); cv.setUint32(28, data.length, true)
    cv.setUint16(32, name.length, true); cv.setUint16(36, 0, true); cv.setUint32(42, 0, true)
    cv.setUint32(46, offset, true)
    c.set(name, 46)
    central.push(c)
  }

  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true)
  const centralDirectorySize = central.reduce((size, entry) => size + entry.length, 0)
  ev.setUint32(12, centralDirectorySize, true)
  ev.setUint32(16, offset, true)
  for (const c of central) push(c)
  push(eocd)

  return new Uint8Array(out)
}
