// ============================================================================
// M5 — PDF Mode A (vue parent en ligne) : fiche mono-page par classe.
// Pattern eprouve bulletin-pdf-button : dynamic import @react-pdf/renderer
// + pdf().toBlob(), Helvetica, N&B sobre, A4. Contenu : frais exacts de la
// classe, echeancier, fournitures/manuel/papeterie/materiel de LA classe.
// ============================================================================

"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type ModeAData = {
  ecoleNom: string
  ecoleVille: string | null
  ecoleContact: string | null
  classe: string
  currency: string
  registrationFee: number | null
  academicFee: number | null
  installments: { label: string; amount: number; due_date: string | null }[]
  manuals: { subject: string; title: string; editor: string; required: boolean }[]
  stationery: { name: string; quantity: string }[]
  equipment: { name: string; quantity: string; required: boolean }[]
  transport: string | null
  cantine: string | null
  tenues: string | null
  notes: string | null
}

function fcfa(n: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(n)} F`
}

export function FicheModeAButton({ data }: { data: ModeAData }) {
  const [busy, setBusy] = useState(false)

  async function handleDownload() {
    setBusy(true)
    try {
      const { Document, Page, Text, View, StyleSheet, pdf } = await import("@react-pdf/renderer")
      const styles = StyleSheet.create({
        page: { padding: 36, fontFamily: "Helvetica", fontSize: 9.5, color: "#111" },
        header: { borderBottomWidth: 2, borderBottomColor: "#000", paddingBottom: 8, marginBottom: 12, textAlign: "center" },
        school: { fontSize: 15, fontWeight: "bold", textTransform: "uppercase" },
        subtitle: { fontSize: 10, color: "#444", marginTop: 3 },
        section: { fontSize: 11, fontWeight: "bold", textTransform: "uppercase", marginTop: 10, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: "#999", paddingBottom: 2 },
        row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
        item: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
        bold: { fontWeight: "bold" },
        muted: { color: "#555" },
        tag: { backgroundColor: "#eee", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, fontSize: 8, marginLeft: 6 },
        footer: { marginTop: 14, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#999", fontSize: 8, color: "#555", textAlign: "center" },
      })
      const total = data.installments.reduce((s, t) => s + (t.amount || 0), 0)
      const Doc = (
        <Document>
          <Page size="A4" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.school}>{data.ecoleNom}</Text>
              <Text style={styles.subtitle}>FICHE DE FOURNITURES & TARIFICATION — {data.classe}{data.ecoleVille ? ` · ${data.ecoleVille}` : ""}</Text>
            </View>
            <Text style={styles.section}>Tarifs — {data.classe} ({data.currency})</Text>
            {data.registrationFee != null ? (<View style={styles.row}><Text>Droits d&apos;inscription</Text><Text style={styles.bold}>{fcfa(data.registrationFee)}</Text></View>) : null}
            {data.academicFee != null ? (<View style={styles.row}><Text>Frais academiques</Text><Text style={styles.bold}>{fcfa(data.academicFee)}</Text></View>) : null}
            {data.installments.map((t, i) => (
              <View key={i} style={styles.row}><Text>{t.label}{t.due_date ? ` — echeance ${t.due_date}` : ""}</Text><Text style={styles.bold}>{fcfa(t.amount)}</Text></View>
            ))}
            {data.installments.length ? (<View style={styles.row}><Text style={styles.bold}>Total echeancier</Text><Text style={styles.bold}>{fcfa(total)}</Text></View>) : null}
            {data.manuals.length ? (<><Text style={styles.section}>Manuels ({data.manuals.length})</Text>{data.manuals.map((m, i) => (<View key={i} style={styles.item}><Text>{m.subject} — {m.title}{m.editor ? ` (${m.editor})` : ""}{m.required ? "  [requis]" : ""}</Text></View>))}</>) : null}
            {data.stationery.length ? (<><Text style={styles.section}>Papeterie ({data.stationery.length})</Text>{data.stationery.map((s, i) => (<View key={i} style={styles.item}><Text>{s.name} × {s.quantity}</Text></View>))}</>) : null}
            {data.equipment.length ? (<><Text style={styles.section}>A apporter a l&apos;inscription ({data.equipment.length})</Text>{data.equipment.map((e, i) => (<View key={i} style={styles.item}><Text>{e.name} × {e.quantity}{e.required ? "  [requis]" : ""}</Text></View>))}</>) : null}
            {data.transport || data.cantine || data.tenues ? (<><Text style={styles.section}>Services</Text>{data.transport ? (<View style={styles.item}><Text>Transport : {data.transport}</Text></View>) : null}{data.cantine ? (<View style={styles.item}><Text>Cantine : {data.cantine}</Text></View>) : null}{data.tenues ? (<View style={styles.item}><Text>Tenues : {data.tenues}</Text></View>) : null}</>) : null}
            {data.notes ? (<><Text style={styles.section}>Informations</Text><View style={styles.item}><Text style={styles.muted}>{data.notes}</Text></View></>) : null}
            <View style={styles.footer}><Text>Genere par Schooly{data.ecoleContact ? ` · ${data.ecoleContact}` : ""} · Edite le {new Date().toLocaleDateString("fr-FR")}</Text></View>
          </Page>
        </Document>
      )
      const blob = await pdf(Doc).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Fiche_${data.classe.replace(/\s+/g, "_")}.pdf`
      document.body.appendChild(link)
      link.click()
      setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url) }, 100)
    } catch (e) {
      console.error("PDF Mode A", e)
      alert("Generation du PDF impossible. Reessayez.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {busy ? "Generation..." : "Telecharger la fiche (PDF)"}
    </Button>
  )
}

export type { ModeAData }
