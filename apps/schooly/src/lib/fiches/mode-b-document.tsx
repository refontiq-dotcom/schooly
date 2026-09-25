// ============================================================================
// M6 — Document PDF « Mode B » (Vue Secrétariat).
// PDF institutionnel A4, ultra-léger : grille tarifaire globale de l'école +
// QR code pointant vers la fiche publique Trouvetou (/fiche/[schoolId]).
// ZÉRO-IMAGE : typographie + filets ; le seul bitmap du document est le QR
// code (généré à la volée via `qrcode` → data URL PNG). Aucune photo.
// NE contient JAMAIS les fournitures : le QR code y renvoie (Mode A côté parent).
// Chargé dynamiquement par app/api/fiches/mode-b/route.ts : react-pdf ne doit
// pas alourdir le bundle serveur initial.
// ============================================================================

import { createElement } from "react"
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import type {
  CyclesOffered,
  FeesStructure,
  OptionalServices,
} from "@/lib/fiches/types"
import { CYCLE_LABELS } from "@/lib/fiches/types"
import { totalInstallments } from "@/lib/fiches/normalize"

export interface ModeBData {
  schoolName: string
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  cycles: CyclesOffered
  fees: FeesStructure
  services: OptionalServices
  /** Data URL PNG du QR code (généré côté route). */
  qrDataUrl: string
  /** URL cible imprimée sous le QR code (transparence + fallback manuel). */
  qrTargetUrl: string
  generatedAt: string
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111111" },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#111111",
    paddingBottom: 8,
  },
  schoolName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  contact: { fontSize: 8, color: "#444444", marginTop: 3 },
  title: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 14,
  },
  subtitle: { fontSize: 8, textAlign: "center", color: "#444444", marginTop: 2 },
  sectionTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
  },
  rowLabel: { flex: 1, paddingRight: 8 },
  rowValue: { fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    paddingVertical: 3,
  },
  thPos: { width: 22, fontFamily: "Helvetica-Bold", fontSize: 8 },
  thLabel: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 8 },
  thAmount: { width: 84, fontFamily: "Helvetica-Bold", fontSize: 8, textAlign: "right" },
  thDue: { width: 68, fontFamily: "Helvetica-Bold", fontSize: 8, textAlign: "right" },
  thStatus: { width: 66, fontFamily: "Helvetica-Bold", fontSize: 8, textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
  },
  tdPos: { width: 22, fontSize: 8 },
  tdLabel: { flex: 1, fontSize: 8 },
  tdAmount: { width: 84, fontSize: 8, textAlign: "right" },
  tdDue: { width: 68, fontSize: 8, textAlign: "right" },
  tdStatus: { width: 66, fontSize: 8, textAlign: "right", color: "#444444" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 4,
    fontFamily: "Helvetica-Bold",
  },
  line: { marginBottom: 2 },
  muted: { color: "#444444" },
  qrBox: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#111111",
    padding: 12,
    alignItems: "center",
  },
  qrImage: { width: 110, height: 110 },
  qrCaption: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginTop: 8,
  },
  qrUrl: { fontSize: 7, color: "#444444", marginTop: 3 },
  notes: { fontSize: 8, fontFamily: "Helvetica-Oblique", color: "#444444", marginTop: 10 },
  footer: {
    fontSize: 7,
    color: "#666666",
    textAlign: "center",
    marginTop: 16,
  },
})
/** Formatage montant sobre : « 12 500 F CFA » (espace simple, sans NBSP). */
function fmtAmount(amount: number, currency: string): string {
  const grouped = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return currency === "XOF" ? `${grouped} F CFA` : `${grouped} ${currency}`
}

/** Échéance ISO « YYYY-MM-DD » → « JJ/MM/AAAA », ou « à préciser ». */
function fmtDueDate(iso: string | null): string {
  if (!iso) return "à préciser"
  const parts = iso.split("-")
  if (parts.length !== 3 || Number.isNaN(Date.parse(iso))) return "à préciser"
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: "tous les élèves",
  new_students: "nouveaux élèves",
  returning: "anciens élèves",
}

const STATUS_LABELS: Record<string, string> = {
  affecte: "Affecté",
  non_affecte: "Non affecté",
}

const DIPLOMA_LABELS: Record<string, string> = {
  aucun: "—",
  cep: "CEP",
  bepc: "BEPC",
  bac: "Bac",
  cap: "CAP",
  bt: "BT",
  bts: "BTS",
  licence: "Licence",
  master: "Master",
}

function contactLine(data: ModeBData): string {
  return [
    data.address,
    data.city,
    data.phone ? `Tél. ${data.phone}` : null,
    data.email,
  ]
    .filter(Boolean)
    .join("  ·  ")
}

function cyclesLines(cycles: CyclesOffered): string[] {
  const lines: string[] = []
  for (const cycle of cycles.cycles) {
    const levelNames = [...cycle.levels]
      .sort((a, b) => a.level - b.level)
      .map((l) => l.grade_level_name)
      .join(", ")
    const series = Array.from(new Set(cycle.series)).join(", ")
    const diplomas = Array.from(
      new Set(cycle.levels.map((l) => DIPLOMA_LABELS[l.diploma] ?? l.diploma)),
    ).join(", ")
    const parts = [
      `${CYCLE_LABELS[cycle.key] ?? cycle.key} —`,
      levelNames ? `niveaux : ${levelNames}` : "niveaux : à compléter",
      series ? `séries : ${series}` : null,
      diplomas && diplomas !== "—" ? `diplôme(s) : ${diplomas}` : null,
    ].filter(Boolean)
    lines.push(parts.join("  "))
  }
  return lines
}

function serviceLines(services: OptionalServices, currency: string): string[] {
  const lines: string[] = []
  if (services.transport.enabled && services.transport.type !== "none") {
    if (services.transport.type === "fixed" && services.transport.zones[0]) {
      lines.push(
        `Transport scolaire — forfait : ${fmtAmount(services.transport.zones[0].price, currency)} / ${services.transport.frequency}`,
      )
    } else {
      for (const zone of services.transport.zones) {
        lines.push(
          `Transport scolaire — ${zone.name} : ${fmtAmount(zone.price, currency)} / ${zone.frequency}`,
        )
      }
    }
  }
  if (services.cantine.enabled && services.cantine.type !== "none") {
    if (services.cantine.type === "fixed" && services.cantine.regimes[0]) {
      lines.push(
        `Cantine — forfait : ${fmtAmount(services.cantine.regimes[0].price, currency)} / ${services.cantine.frequency}`,
      )
    } else {
      for (const regime of services.cantine.regimes) {
        lines.push(
          `Cantine — ${regime.name} : ${fmtAmount(regime.price, currency)} / ${regime.frequency}`,
        )
      }
    }
  }
  if (services.tenues.enabled && services.tenues.type !== "none") {
    for (const item of services.tenues.items) {
      lines.push(
        `Tenue réglementaire — ${item.name} : ${fmtAmount(item.price, currency)} (${item.one_time ? "achat unique" : "fournie par l'école"})`,
      )
    }
  }
  return lines
}

function ModeBDocumentComponent({ data }: { data: ModeBData }) {
  const currency = data.fees.currency || "XOF"
  const feeRows: Array<{ label: string; amount: number }> = []
  if (data.fees.registration_fee) {
    const f = data.fees.registration_fee
    feeRows.push({
      label: `${f.label ?? "Droits d'inscription"} (${AUDIENCE_LABELS[f.applies_to] ?? "tous les élèves"})`,
      amount: f.amount,
    })
  }
  if (data.fees.academic_fee) {
    const f = data.fees.academic_fee
    feeRows.push({
      label: `${f.label ?? "Scolarité annuelle"} (${AUDIENCE_LABELS[f.applies_to] ?? "tous les élèves"})`,
      amount: f.amount,
    })
  }
  const installmentLines = [...data.fees.installments].sort(
    (a, b) => a.position - b.position,
  )
  const cycleLines = cyclesLines(data.cycles)
  const extraServices = serviceLines(data.services, currency)

  return (
    <Document title={`Grille tarifaire — ${data.schoolName}`} creator="Schooly">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.schoolName}>{data.schoolName}</Text>
          <Text style={styles.contact}>{contactLine(data) || "—"}</Text>
        </View>

        <Text style={styles.title}>GRILLE TARIFAIRE OFFICIELLE</Text>
        <Text style={styles.subtitle}>
          Document institutionnel — généré le {data.generatedAt}
        </Text>

        <Text style={styles.sectionTitle}>Frais de scolarité</Text>
        {feeRows.length === 0 && installmentLines.length === 0 ? (
          <Text style={styles.muted}>Aucun tarif renseigné pour le moment.</Text>
        ) : (
          <>
            {feeRows.map((row) => (
              <View key={row.label} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{fmtAmount(row.amount, currency)}</Text>
              </View>
            ))}
            {installmentLines.length > 0 && (
              <>
                <View style={styles.tableHeader}>
                  <Text style={styles.thPos}>N°</Text>
                  <Text style={styles.thLabel}>Tranche</Text>
                  <Text style={styles.thAmount}>Montant</Text>
                  <Text style={styles.thDue}>Échéance</Text>
                  <Text style={styles.thStatus}>Statut</Text>
                </View>
                {installmentLines.map((inst) => (
                  <View key={`${inst.position}-${inst.label}`} style={styles.tableRow}>
                    <Text style={styles.tdPos}>{inst.position}</Text>
                    <Text style={styles.tdLabel}>{inst.label}</Text>
                    <Text style={styles.tdAmount}>{fmtAmount(inst.amount, currency)}</Text>
                    <Text style={styles.tdDue}>{fmtDueDate(inst.due_date)}</Text>
                    <Text style={styles.tdStatus}>{STATUS_LABELS[inst.status] ?? "—"}</Text>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text>
                    Total échéancier : {fmtAmount(totalInstallments(data.fees.installments), currency)}
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Offre académique</Text>
        {cycleLines.length === 0 ? (
          <Text style={styles.muted}>Aucun cycle déclaré.</Text>
        ) : (
          cycleLines.map((line) => (
            <Text key={line} style={styles.line}>{line}</Text>
          ))
        )}

        <Text style={styles.sectionTitle}>Services optionnels</Text>
        {extraServices.length === 0 ? (
          <Text style={styles.muted}>Aucun service optionnel déclaré.</Text>
        ) : (
          extraServices.map((line) => (
            <Text key={line} style={styles.line}>{line}</Text>
          ))
        )}

        {data.fees.notes ? (
          <Text style={styles.notes}>Notes : {data.fees.notes}</Text>
        ) : null}

        <View style={styles.qrBox}>
          {/* Le renderer PDF ne rend pas d'arbre HTML : `alt` n'est pas un
              prop valide, et la cible imprimée sous le QR joue ce rôle. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.qrImage} src={data.qrDataUrl} />
          <Text style={styles.qrCaption}>
            Scannez ce code pour télécharger la liste des fournitures de la classe de votre enfant.
          </Text>
          <Text style={styles.qrUrl}>{data.qrTargetUrl}</Text>
        </View>

        <Text style={styles.footer}>Généré par Schooly — {data.generatedAt}</Text>
      </Page>
    </Document>
  )
}

/**
 * Rend le PDF Mode B en buffer. Point d'entrée unique utilisé par la route
 * (import dynamique) : `renderToBuffer` n'est chargé qu'à la demande.
 * Les casts explicites contournent le typage strict de react-pdf v4
 * (ReactElement<DocumentProps>) et de BodyInit (Uint8Array<ArrayBuffer>).
 */
export async function renderModeB(data: ModeBData): Promise<Uint8Array<ArrayBuffer>> {
  const { renderToBuffer } = await import("@react-pdf/renderer")
  const element = createElement(ModeBDocumentComponent, { data }) as never
  const buffer = await renderToBuffer(element)
  // Copie vers un ArrayBuffer dédié : Buffer de Node = ArrayBufferLike,
  // refusé par le typage BodyInit de Response.
  const out = new Uint8Array(buffer.byteLength)
  out.set(buffer)
  return out
}
