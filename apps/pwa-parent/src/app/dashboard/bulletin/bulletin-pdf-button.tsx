"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { type BulletinData } from "../actions"

const DECISION_LABELS: Record<string, string> = {
  admitted: "Admis",
  repeated: "Redouble",
  excluded: "Exclu",
  pending: "En attente du conseil",
}

function appreciation(moyenne: number | null) {
  if (moyenne === null) return "—"
  if (moyenne >= 16) return "Très bien"
  if (moyenne >= 14) return "Bien"
  if (moyenne >= 12) return "Assez bien"
  if (moyenne >= 10) return "Passable"
  return "Insuffisant"
}

export function BulletinPdfButton({ data }: { data: BulletinData }) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownload = async () => {
    setIsGenerating(true)
    try {
      // Dynamic import to keep initial bundle size small
      const { Document, Page, Text, View, StyleSheet, pdf, Font } = await import("@react-pdf/renderer")

      // Font registration (optional, but good for reliable rendering)
      // We use default fonts for now to avoid loading external assets.

      const styles = StyleSheet.create({
        page: {
          padding: 40,
          fontFamily: "Helvetica",
          fontSize: 10,
        },
        header: {
          borderBottomWidth: 2,
          borderBottomColor: "#000",
          paddingBottom: 10,
          marginBottom: 20,
          textAlign: "center",
        },
        schoolName: {
          fontSize: 16,
          fontWeight: "bold",
          textTransform: "uppercase",
        },
        subtitle: {
          fontSize: 10,
          color: "#444",
          marginTop: 4,
        },
        infoGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          marginBottom: 20,
        },
        infoItem: {
          width: "50%",
          marginBottom: 6,
        },
        infoLabel: {
          color: "#444",
        },
        infoValue: {
          fontWeight: "bold",
        },
        tableTitle: {
          fontSize: 12,
          fontWeight: "bold",
          textTransform: "uppercase",
          marginBottom: 6,
        },
        table: {
          width: "100%",
          marginBottom: 20,
        },
        tableHeader: {
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: "#666",
          paddingBottom: 4,
          marginBottom: 4,
        },
        tableRow: {
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: "#eee",
          paddingVertical: 6,
        },
        col1: { width: "40%" },
        col2: { width: "30%", textAlign: "center" },
        col3: { width: "30%", textAlign: "center" },
        bold: { fontWeight: "bold" },
        generalAverageContainer: {
          flexDirection: "row",
          justifyContent: "space-between",
          backgroundColor: "#fef3c7",
          padding: 10,
          borderRadius: 4,
          marginBottom: 15,
        },
        generalAverageText: {
          fontWeight: "bold",
        },
        generalAverageValue: {
          fontWeight: "bold",
          fontSize: 14,
          color: "#b45309",
        },
        decisionContainer: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 15,
        },
        observationsSection: {
          marginTop: 10,
        },
        observationsBox: {
          backgroundColor: "#f5f5f5",
          padding: 10,
          borderRadius: 4,
          marginTop: 5,
        },
        footer: {
          position: "absolute",
          bottom: 30,
          left: 40,
          right: 40,
          flexDirection: "row",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderTopColor: "#999",
          paddingTop: 5,
          fontSize: 8,
          color: "#666",
        },
      })

      const BulletinDocument = () => {
        const { child, schoolCity, subjectAverages, generalAverage, decision, observations, councilAverage } = data

        return (
          <Document>
            <Page size="A4" style={styles.page}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.schoolName}>
                  {child.schoolName}
                  {schoolCity ? ` — ${schoolCity}` : ""}
                </Text>
                <Text style={styles.subtitle}>Bulletin de notes — {child.yearLabel}</Text>
              </View>

              {/* Student Info */}
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text>
                    <Text style={styles.infoLabel}>Élève : </Text>
                    <Text style={styles.infoValue}>
                      {child.studentName}
                      {child.matricule ? ` (${child.matricule})` : ""}
                    </Text>
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text>
                    <Text style={styles.infoLabel}>Classe : </Text>
                    <Text style={styles.infoValue}>{child.className ?? "—"}</Text>
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text>
                    <Text style={styles.infoLabel}>Niveau : </Text>
                    <Text>{child.gradeLevel}</Text>
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text>
                    <Text style={styles.infoLabel}>Édité le : </Text>
                    <Text>{new Date().toLocaleDateString("fr-FR")}</Text>
                  </Text>
                </View>
              </View>

              {/* Grades Table */}
              <Text style={styles.tableTitle}>Synthèse par matière</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.col1, { color: "#666" }]}>MATIÈRE</Text>
                  <Text style={[styles.col2, { color: "#666" }]}>MOY. /20</Text>
                  <Text style={[styles.col3, { color: "#666" }]}>APPRÉCIATION</Text>
                </View>
                {subjectAverages.map((s, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={styles.col1}>{s.subject}</Text>
                    <Text style={[styles.col2, styles.bold]}>
                      {s.average === null ? "—" : s.average.toFixed(2)}
                    </Text>
                    <Text style={styles.col3}>{appreciation(s.average)}</Text>
                  </View>
                ))}
                {subjectAverages.length === 0 && (
                  <View style={[styles.tableRow, { justifyContent: "center", paddingVertical: 15 }]}>
                    <Text style={{ color: "#999" }}>Aucune note saisie pour le moment.</Text>
                  </View>
                )}
              </View>

              {/* General Average */}
              <View style={styles.generalAverageContainer}>
                <Text style={styles.generalAverageText}>Moyenne générale</Text>
                <Text style={styles.generalAverageValue}>
                  {generalAverage === null ? "—" : `${generalAverage.toFixed(2)} / 20`}
                </Text>
              </View>

              {/* Council Decision */}
              <View style={styles.decisionContainer}>
                <Text>
                  <Text style={styles.infoLabel}>Décision du conseil : </Text>
                  <Text style={styles.infoValue}>{DECISION_LABELS[decision] ?? decision}</Text>
                </Text>
                {councilAverage !== null && (
                  <Text>
                    <Text style={styles.infoLabel}>Moyenne du conseil : </Text>
                    <Text style={styles.infoValue}>{councilAverage.toFixed(2)} / 20</Text>
                  </Text>
                )}
              </View>

              {/* Observations */}
              {observations && (
                <View style={styles.observationsSection}>
                  <Text style={styles.tableTitle}>Observations</Text>
                  <View style={styles.observationsBox}>
                    <Text>{observations}</Text>
                  </View>
                </View>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <Text>Document généré par Schooly — vérifiable auprès du secrétariat.</Text>
                <Text>
                  Édité le {new Date().toLocaleDateString("fr-FR")} ·{" "}
                  {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </Page>
          </Document>
        )
      }

      const blob = await pdf(<BulletinDocument />).toBlob()
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement("a")
      link.href = url
      link.download = `Bulletin_${data.child.studentName.replace(/\s+/g, "_")}.pdf`
      document.body.appendChild(link)
      link.click()
      
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 100)
    } catch (error) {
      console.error("Erreur lors de la génération du PDF", error)
      alert("Une erreur est survenue lors de la génération du PDF.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button size="sm" onClick={handleDownload} disabled={isGenerating}>
      {isGenerating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {isGenerating ? "Génération..." : "Télécharger PDF"}
    </Button>
  )
}
