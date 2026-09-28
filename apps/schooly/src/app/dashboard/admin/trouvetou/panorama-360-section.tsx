"use client"

/**
 * Import d'une visite 360° par l'établissement.
 *
 * Le parcours suit exactement le contrat serveur existant :
 *   POST /media/panorama  → URL signée + création de la ligne `school_media`
 *   PUT  /media/panorama  → Schooly relit les octets dans R2 et décide
 *   PATCH/media/panorama  → publication (unique par établissement)
 *
 * Aucun traitement n'est appliqué au fichier : il part tel quel vers R2 et
 * c'est la route qui le relit pour le contrôler. Cette interface n'assemble
 * rien, n'améliore rien et ne fait appel à aucun service d'image.
 */
import { useCallback, useRef, useState } from "react"
import Image from "next/image"
import { CheckCircle2, ImageUp, Info, Loader2, RotateCcw, Upload, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ACCEPTED_FORMATS_LABEL,
  MAX_BYTES_LABEL,
  PANORAMA_ACCEPT_ATTRIBUTE,
  PANORAMA_MIN_HEIGHT,
  PANORAMA_MIN_WIDTH,
  describeRejection,
  formatBytes,
  humanizeApiError,
  precheckDimensions,
  precheckFileHeader,
  rejectionFromReport,
  type PanoramaReport,
} from "./_lib/panorama-upload"
import type { SchoolPanorama } from "./_lib/types"

const ENDPOINT = "/api/v1/admin/trouvetou/media/panorama"

type Phase = "idle" | "ready" | "uploading" | "validating" | "validated" | "rejected" | "publishing" | "published"

type Props = {
  /** Dernière ligne `panorama_360` de l'établissement, lue en base. */
  panorama: SchoolPanorama | null
  /** Rafraîchit la page serveur après une publication. */
  onPublished: () => void
}

type RejectionView = ReturnType<typeof describeRejection>

/**
 * Envoi direct vers R2 avec progression réelle.
 *
 * `fetch` n'expose pas la progression d'envoi : seul XHR la donne. Le fichier
 * ne transite jamais par la fonction Next.js, ce qui permet de dépasser le
 * plafond de requête de Vercel.
 */
function uploadToR2(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("")))
    xhr.onerror = () => reject(new Error(""))
    xhr.send(file)
  })
}

/**
 * Dimensions réelles, lues par le navigateur.
 *
 * Volontairement best-effort : une mesure impossible (format exotique, API
 * indisponible) ne doit jamais empêcher l'envoi. Le serveur, lui, mesurera
 * pour de vrai sur les octets.
 */
async function probeDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null
  try {
    const bitmap = await createImageBitmap(file)
    const measured = { width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return measured
  } catch {
    return null
  }
}


export function Panorama360Section({ panorama, onPublished }: Props) {
  const [override, setOverride] = useState<SchoolPanorama | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<PanoramaReport | null>(null)
  const [rejection, setRejection] = useState<RejectionView | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const previewRef = useRef<string | null>(null)
  const probeToken = useRef(0)

  const current = override ?? panorama
  // Un panorama déjà publié AVANT cet import : c'est lui que la publication
  // va remplacer. On se base sur la prop serveur, pas sur `current`, qui
  // désigne le nouveau fichier dès qu'il est validé.
  const hadPublished = panorama?.status === "published"
  const busy = phase === "uploading" || phase === "validating" || phase === "publishing"
  const canImport = Boolean(file) && !busy && !error

  const releasePreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPreview(null)
  }, [])

  const reset = useCallback(() => {
    probeToken.current += 1
    releasePreview()
    setFile(null)
    setDimensions(null)
    setPhase("idle")
    setProgress(0)
    setError(null)
    setReport(null)
    setRejection(null)
    setConfirmReplace(false)
    if (inputRef.current) inputRef.current.value = ""
  }, [releasePreview])

  /**
   * Sélection locale. Ne conclut rien sur la nature de l'image : elle annonce
   * seulement ce qui a été mesuré sur l'en-tête et les dimensions, et laisse
   * le serveur seul juge du raccord gauche/droit.
   */
  const handleFile = useCallback(
    async (picked: File) => {
      probeToken.current += 1
      const token = probeToken.current

      setError(null)
      setReport(null)
      setRejection(null)
      setConfirmReplace(false)
      releasePreview()

      const header = precheckFileHeader(picked)
      if (header?.blocking) {
        setFile(null)
        setDimensions(null)
        setPhase("idle")
        setError(header.message)
        return
      }

      setFile(picked)
      setPhase("ready")
      setProgress(0)
      if (typeof URL.createObjectURL === "function") {
        const url = URL.createObjectURL(picked)
        previewRef.current = url
        setPreview(url)
      }

      const measured = await probeDimensions(picked)
      if (token !== probeToken.current || !measured) return

      const dimension = precheckDimensions(measured.width, measured.height)
      if (dimension?.blocking) setError(dimension.message)
      else setDimensions(measured)
    },
    [releasePreview],
  )

  const handleSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0]
      // Vider l'input permet de resélectionner le même fichier après un échec.
      event.target.value = ""
      if (picked) void handleFile(picked)
    },
    [handleFile],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault()
      const picked = event.dataTransfer.files?.[0]
      if (picked) void handleFile(picked)
    },
    [handleFile],
  )

  /** POST (autorisation) → dépôt direct R2 → PUT (validation Schooly). */
  const handleImport = useCallback(async () => {
    if (!file || busy) return

    setPhase("uploading")
    setProgress(0)
    setError(null)

    let ticket: { mediaId: string; uploadUrl: string; publicUrl: string; headers: Record<string, string> }
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(humanizeApiError(res.status, data?.error))
        setPhase("ready")
        return
      }
      ticket = data
    } catch {
      setError(humanizeApiError(0, null))
      setPhase("ready")
      return
    }

    try {
      await uploadToR2(ticket.uploadUrl, ticket.headers ?? {}, file, setProgress)
    } catch {
      setError("Erreur d'upload vers le stockage. Vérifie ta connexion puis réessaie.")
      setPhase("ready")
      return
    }

    setPhase("validating")
    try {
      const res = await fetch(ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: ticket.mediaId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(humanizeApiError(res.status, data?.error))
        setPhase("ready")
        return
      }

      const serverReport = (data.report ?? null) as PanoramaReport | null
      setReport(serverReport)
      const found = rejectionFromReport(serverReport)

      setOverride({
        id: ticket.mediaId,
        status: data.status === "validated" ? "validated" : "rejected",
        public_url: ticket.publicUrl,
        width: serverReport?.width ?? null,
        height: serverReport?.height ?? null,
        byte_size: serverReport?.byteSize ?? null,
        rejection_code: found?.code ?? null,
        rejection_details: found?.details ?? null,
        published_at: null,
      })

      if (data.status === "validated") {
        setRejection(null)
        setPhase("validated")
      } else {
        setRejection(describeRejection(found?.code ?? null, found?.details ?? null))
        setPhase("rejected")
      }
    } catch {
      setError(humanizeApiError(0, null))
      setPhase("ready")
    }
  }, [file, busy])

  /** PATCH : la publication. Le serveur rétrograde l'éventuelle visite publiée. */
  const handlePublish = useCallback(async () => {
    if (!current || current.status !== "validated" || busy) return

    setPhase("publishing")
    setError(null)
    try {
      const res = await fetch(ENDPOINT, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: current.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(humanizeApiError(res.status, data?.error))
        setPhase("validated")
        return
      }
      setOverride({ ...current, status: "published", published_at: new Date().toISOString() })
      setPhase("published")
      setConfirmReplace(false)
      onPublished()
    } catch {
      setError(humanizeApiError(0, null))
      setPhase("validated")
    }
  }, [current, busy, onPublished])

  const publishedPanorama = current?.status === "published"

  return (
    <section aria-labelledby="panorama-360-titre" className="rounded-xl border border-border/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="panorama-360-titre" className="font-medium">
            Photo 360° de l&apos;établissement
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Importez une image panoramique 360° provenant d&apos;une caméra 360° ou d&apos;une application de
            stitching. Schooly ne transforme pas les photos classiques en panorama 360°.
          </p>
        </div>
        {current && <StatusBadge status={current.status} />}
      </div>

      {current && (
        <div className="mt-4 flex gap-3 rounded-xl border border-border/60 bg-muted/25 p-3">
          <div className="relative h-16 w-32 shrink-0 overflow-hidden rounded-lg border bg-muted">
            <Image src={current.public_url} alt="Aperçu de la visite 360°" fill sizes="128px" unoptimized className="object-cover" />
          </div>
          <div className="min-w-0 text-xs">
            <p className="font-medium">{STATUS_LABELS[current.status]}</p>
            <p className="mt-0.5 text-muted-foreground">{STATUS_HINTS[current.status]}</p>
            {current.width && current.height && (
              <p className="mt-1 text-muted-foreground">
                {current.width}×{current.height}px
                {current.byte_size ? ` · ${formatBytes(current.byte_size)}` : ""}
              </p>
            )}
            {current.status === "rejected" && current.rejection_details && (
              <p className="mt-1 text-muted-foreground">{current.rejection_details}</p>
            )}
          </div>
        </div>
      )}

      {publishedPanorama && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
          Cette visite 360° est publiée. Utilise « Publier la fiche » pour l&apos;envoyer vers Trouvetou. Pour la
          changer, importe un nouveau fichier ci-dessous : la visite publiée actuelle repassera automatiquement en
          « validée », et une seule restera publiée.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {rejection && !error && (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            {rejection.headline}
          </p>
          <p className="mt-1.5 text-foreground">{rejection.action}</p>
          {rejection.detail && <p className="mt-1.5 text-muted-foreground">{rejection.detail}</p>}
        </div>
      )}

      {phase === "validated" && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Schooly a contrôlé le fichier et l&apos;a validé. Publie-le pour le rendre visible sur Trouvetou.</span>
        </p>
      )}

      {phase === "published" && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Visite 360° publiée. Utilise « Publier la fiche » pour l&apos;envoyer vers Trouvetou.</span>
        </p>
      )}

      {report && (
        <details className="mt-3 rounded-xl border border-border/60 p-3 text-xs">
          <summary className="cursor-pointer font-medium">Détail du contrôle Schooly</summary>
          <p className="mt-1.5 text-muted-foreground">{report.summary}</p>
          <ul className="mt-2 space-y-1.5">
            {report.checks.map((check) => (
              <li key={check.id} className="flex gap-2">
                <span
                  className={
                    check.status === "PASS"
                      ? "font-medium text-emerald-700 dark:text-emerald-300"
                      : check.status === "WARNING"
                        ? "font-medium text-amber-700 dark:text-amber-300"
                        : "font-medium text-destructive"
                  }
                >
                  {check.status === "PASS" ? "OK" : check.status === "WARNING" ? "Attention" : "Refusé"}
                </span>
                <span className="text-muted-foreground">{check.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <label
        htmlFor="panorama-360-input"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border p-6 text-center transition hover:border-primary/60 hover:bg-muted/40"
      >
        <ImageUp className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium">Choisis ton fichier 360°</span>
        <span className="text-xs text-muted-foreground">ou dépose-le ici</span>
        <span className="text-xs text-muted-foreground">
          {ACCEPTED_FORMATS_LABEL} · {MAX_BYTES_LABEL} maximum · {PANORAMA_MIN_WIDTH}×{PANORAMA_MIN_HEIGHT}px minimum ·
          ratio 2:1
        </span>
        <input
          ref={inputRef}
          id="panorama-360-input"
          type="file"
          accept={PANORAMA_ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={handleSelect}
          disabled={busy}
        />
      </label>

      {file && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 p-3">
          {preview ? (
            <div className="relative h-12 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
              <Image src={preview} alt="" fill unoptimized className="object-cover" />
            </div>
          ) : (
            <div className="flex h-12 w-24 shrink-0 items-center justify-center rounded-lg border bg-muted">
              <ImageUp className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-medium">{file.name}</p>
            <p className="text-muted-foreground">
              {formatBytes(file.size)}
              {dimensions ? ` · ${dimensions.width}×${dimensions.height}px` : ""}
            </p>
          </div>
        </div>
      )}

      {busy && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {phase === "uploading" && `Envoi vers le stockage… ${progress} %`}
          {phase === "validating" && "Schooly contrôle les pixels de l'image…"}
          {phase === "publishing" && "Publication…"}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!canImport}
          onClick={() => void handleImport()}
          data-testid="panorama-import"
        >
          <Upload className="mr-2 h-4 w-4" />
          {hadPublished ? "Importer un nouveau panorama" : "Importer la visite 360°"}
        </Button>

        {current?.status === "validated" &&
          (confirmReplace ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => void handlePublish()} data-testid="panorama-publish-confirm">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmer le remplacement
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={busy} onClick={() => (hadPublished ? setConfirmReplace(true) : void handlePublish())} data-testid="panorama-publish">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {hadPublished ? "Remplacer la visite publiée" : "Publier la visite 360°"}
            </Button>
          ))}

        {(file || report || error) && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Recommencer
          </Button>
        )}
      </div>

      {confirmReplace && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>La visite 360° actuellement publiée repassera en « validée ». Une seule visite reste publiée.</span>
        </p>
      )}

      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Schooly ne génère pas de panorama : importe le fichier tel qu&apos;il sort de ta caméra 360° ou de
          l&apos;application de stitching. Le fichier déposé est conservé sans aucune retouche.
        </span>
      </p>
    </section>
  )
}

const STATUS_LABELS: Record<SchoolPanorama["status"], string> = {
  uploaded: "Déposé, en attente de contrôle",
  validated: "Validée par Schooly",
  rejected: "Refusée par Schooly",
  published: "Publiée",
}

const STATUS_HINTS: Record<SchoolPanorama["status"], string> = {
  uploaded: "Schooly n'a pas encore contrôlé cette image.",
  validated: "Contrôle réussi. Elle n'est pas encore visible sur Trouvetou.",
  rejected: "Ce fichier a été refusé : son état est définitif, il faut en importer un autre.",
  published: "Visible sur Trouvetou une fois la fiche publiée.",
}

function StatusBadge({ status }: { status: SchoolPanorama["status"] }) {
  const variant = status === "published" ? "default" : status === "rejected" ? "destructive" : "secondary"
  return (
    <Badge variant={variant} data-testid="panorama-status">
      {STATUS_LABELS[status]}
    </Badge>
  )
}
