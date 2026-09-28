// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })

vi.mock("lucide-react", () => {
  const Icon = () => null
  return {
    CheckCircle2: Icon, ImageUp: Icon, Info: Icon, Loader2: Icon,
    RotateCcw: Icon, Upload: Icon, XCircle: Icon,
  }
})
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => React.createElement("img", { alt, "data-testid": "remote-image" }),
}))

import { Panorama360Section } from "./panorama-360-section"
import type { SchoolPanorama } from "./_lib/types"
import { PANORAMA_MAX_BYTES } from "./_lib/panorama-upload"

const ENDPOINT = "/api/v1/admin/trouvetou/media/panorama"

const PUBLISHED: SchoolPanorama = {
  id: "med-published",
  status: "published",
  public_url: "https://cdn.example.com/pano.jpg",
  width: 6000,
  height: 3000,
  byte_size: 6 * 1024 * 1024,
  rejection_code: null,
  rejection_details: null,
  published_at: "2026-09-20T10:00:00.000Z",
}

const report = (over: Partial<{ width: number; height: number; ratio: number }> = {}) => ({
  status: "PASS",
  summary: "Contrôle terminé.",
  width: over.width ?? 6000,
  height: over.height ?? 3000,
  ratio: over.ratio ?? 2,
  byteSize: 6 * 1024 * 1024,
  checks: [
    { id: "ratio", status: "PASS", detail: "Ratio conforme : 2.00:1." },
    { id: "seam", status: "PASS", detail: "Raccord continu : discontinuité 1.20× le bruit interne." },
  ],
})

const jsonResponse = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })

/** XHR minimal : le dépôt direct R2 passe nécessairement par lui. */
class FakeXhr {
  static last: FakeXhr | null = null
  static fail = false
  upload = { onprogress: null as null | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) }
  status = 200
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  method = ""
  constructor() {
    FakeXhr.last = this
  }
  open(method: string) {
    this.method = method
  }
  setRequestHeader() {}
  send() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: this.status, total: 100 })
    if (FakeXhr.fail) this.onerror?.()
    else this.onload?.()
  }
}

let container: HTMLElement
let root: Root

function render(props: { panorama?: SchoolPanorama | null; onPublished?: () => void } = {}) {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <Panorama360Section panorama={props.panorama ?? null} onPublished={props.onPublished ?? (() => {})} />,
    )
  })
}

const text = () => container.textContent ?? ""
const testId = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const fileInput = () => container.querySelector('input[type="file"]') as HTMLInputElement
const button = (id: string) => testId(id) as HTMLButtonElement

function selectFile(file: File) {
  act(() => {
    Object.defineProperty(fileInput(), "files", { value: [file], configurable: true })
    fileInput().dispatchEvent(new Event("change", { bubbles: true }))
  })
}


/** `size` est en lecture seule : on le force pour tester la limite. */
function sizedFile(size: number, type = "image/jpeg") {
  const file = new File([new Uint8Array(1)], "pano.jpg", { type })
  Object.defineProperty(file, "size", { value: size })
  return file
}

async function clickAndSettle(element: HTMLElement) {
  await act(async () => {
    element.click()
  })
}

/** Chaîne POST → PUT R2 (synchrone) → PUT de validation. */
function mockHappyPath(validation = report()) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    if (url === ENDPOINT && method === "POST") {
      return jsonResponse({
        mediaId: "med-1",
        uploadUrl: "https://r2.example.com/put",
        publicUrl: "https://cdn.example.com/pano.jpg",
        headers: { "Content-Type": "image/jpeg" },
      })
    }
    if (url === ENDPOINT && method === "PUT") {
      // Le serveur déduit le statut du rapport ; le double doit faire pareil,
      // sinon le test vérifierait un cas impossible.
      const status = validation.checks.some((check) => check.status === "FAIL") ? "rejected" : "validated"
      return jsonResponse({ success: status === "validated", mediaId: "med-1", status, summary: validation.summary, report: validation })
    }
    if (url === ENDPOINT && method === "PATCH") {
      return jsonResponse({ success: true, mediaId: "med-1", status: "published" })
    }
    return jsonResponse({ error: "inattendu" }, 500)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  FakeXhr.fail = false
  FakeXhr.last = null
  vi.stubGlobal("XMLHttpRequest", FakeXhr)
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:panorama"),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("affichage de la section", () => {
  it("annonce clairement la nature de l'import attendu", () => {
    render()
    expect(text()).toContain("Photo 360° de l'établissement")
    expect(text()).toContain("caméra 360° ou d'une application de stitching")
    expect(text()).toContain("ne transforme pas les photos classiques en panorama")
  })

  it("affiche les formats, la taille et les dimensions exigées", () => {
    render()
    expect(text()).toContain("JPEG, PNG ou WebP")
    expect(text()).toContain("15,0 Mo maximum")
    expect(text()).toContain("3000×1500px minimum")
    expect(text()).toContain("ratio 2:1")
  })

  it("propose un champ de fichier et un bouton d'import", () => {
    render()
    expect(fileInput()).toBeTruthy()
    expect(fileInput().getAttribute("accept")).toBe("image/jpeg,image/png,image/webp")
    expect(button("panorama-import")).toBeTruthy()
  })

  it("n'affiche aucun statut quand aucun panorama n'existe", () => {
    render()
    expect(testId("panorama-status")).toBeNull()
  })

  it("montre l'état d'un panorama existant", () => {
    render({ panorama: PUBLISHED })
    expect(testId("panorama-status")?.textContent).toBe("Publiée")
    expect(text()).toContain("6000×3000px")
  })
})

describe("sélection d'un fichier", () => {
  it("accepte un JPEG valide et affiche son nom", () => {
    render()
    selectFile(sizedFile(4 * 1024 * 1024))
    expect(text()).toContain("pano.jpg")
    expect(text()).toContain("4,0 Mo")
  })

  it("refuse un format interdit avant tout envoi", () => {
    render()
    selectFile(sizedFile(1024, "image/gif"))
    expect(text()).toContain("Format non pris en charge")
    expect(button("panorama-import")?.disabled).toBe(true)
  })

  it("refuse un fichier trop volumineux avant tout envoi", () => {
    render()
    selectFile(sizedFile(PANORAMA_MAX_BYTES + 1))
    expect(text()).toContain("trop volumineux")
    expect(button("panorama-import")?.disabled).toBe(true)
  })

  it("n'annonce jamais qu'un fichier est une vraie photo 360°", () => {
    render()
    selectFile(sizedFile(4 * 1024 * 1024))
    expect(text()).not.toMatch(/vraie photo 360|est bien un panorama/i)
  })

  it("permet de recommencer après un refus", () => {
    render()
    selectFile(sizedFile(1024, "image/gif"))
    const restart = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Recommencer"))
    expect(restart).toBeTruthy()
    act(() => (restart as HTMLButtonElement).click())
    expect(text()).not.toContain("Format non pris en charge")
  })
})

describe("import et validation serveur", () => {
  it("suit POST puis PUT, et affiche la validation réussie", async () => {
    const fetchMock = mockHappyPath()
    render()
    selectFile(sizedFile(4 * 1024 * 1024))
    await clickAndSettle(button("panorama-import"))

    const methods = fetchMock.mock.calls.map(([, init]) => init?.method)
    expect(methods).toEqual(["POST", "PUT"])
    expect(FakeXhr.last?.method).toBe("PUT")
    expect(text()).toContain("l'a validé")
    expect(testId("panorama-status")?.textContent).toBe("Validée par Schooly")
  })

  it("affiche le rapport de contrôle réellement renvoyé par le serveur", async () => {
    mockHappyPath()
    render()
    selectFile(sizedFile(4 * 1024 * 1024))
    await clickAndSettle(button("panorama-import"))
    expect(text()).toContain("Détail du contrôle Schooly")
    expect(text()).toContain("Raccord continu")
  })

  it("affiche l'état rejeté avec le motif et la conduite à tenir", async () => {
    const failing = {
      ...report(),
      status: "FAIL",
      summary: "1 contrôle en échec.",
      checks: [{ id: "seam", status: "FAIL", detail: "Raccord visible : discontinuité 3.40× le bruit interne." }],
    }
    mockHappyPath(failing)
    render()
    selectFile(sizedFile(4 * 1024 * 1024))
    await clickAndSettle(button("panorama-import"))

    expect(text()).toContain("Raccord gauche/droite non conforme")
    expect(text()).toContain("Raccord visible")
    expect(testId("panorama-status")?.textContent).toBe("Refusée par Schooly")
    expect(button("panorama-publish")).toBeNull()
  })

  it("affiche une erreur lisible quand le serveur refuse l'upload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Format accepté : JPG, PNG ou WebP" }, 400)))
    render()
    selectFile(sizedFile(4 * 1024 * 1024))
    await clickAndSettle(button("panorama-import"))
    expect(text()).toContain("Format accepté")
  })

  it("signale une erreur réseau sans message technique", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))
    render()
    selectFile(sizedFile(4 * 1024 * 1024))
    await clickAndSettle(button("panorama-import"))
    expect(text()).toContain("Connexion interrompue")
  })

  it("signale un échec de dépôt vers le stockage", async () => {
    mockHappyPath()
    FakeXhr.fail = true
    render()
    selectFile(sizedFile(4 * 1024 * 1024))
    await clickAndSettle(button("panorama-import"))
    expect(text()).toContain("Erreur d'upload vers le stockage")
  })
})

describe("publication", () => {
  it("publie le panorama validé et prévient le parent", async () => {
    const onPublished = vi.fn()
    mockHappyPath()
    render({ onPublished })
    selectFile(sizedFile(4 * 1024 * 1024))
    await clickAndSettle(button("panorama-import"))
    await clickAndSettle(button("panorama-publish"))

    expect(onPublished).toHaveBeenCalledTimes(1)
    expect(testId("panorama-status")?.textContent).toBe("Publiée")
  })

  it("demande confirmation avant de remplacer un panorama déjà publié", async () => {
    mockHappyPath()
    render({ panorama: PUBLISHED })
    selectFile(sizedFile(4 * 1024 * 1024))
    await clickAndSettle(button("panorama-import"))

    expect(button("panorama-publish")?.textContent).toContain("Remplacer la visite publiée")
    await clickAndSettle(button("panorama-publish"))
    expect(button("panorama-publish-confirm")).toBeTruthy()
    expect(text()).toContain("repassera en « validée »")
  })

  it("explique la règle d'un seul panorama publié", () => {
    render({ panorama: PUBLISHED })
    expect(text()).toContain("une seule restera publiée")
  })

  it("n'expose aucune action de publication sur un panorama rejeté", () => {
    render({ panorama: { ...PUBLISHED, status: "rejected", rejection_code: "torn_seam" } })
    expect(testId("panorama-status")?.textContent).toBe("Refusée par Schooly")
    expect(button("panorama-publish")).toBeNull()
  })
})
