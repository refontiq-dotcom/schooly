// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React })

// Convention repo : les icônes lucide sont mockées (double copie de React).
vi.mock("lucide-react", () => {
  const Icon = () => null
  return {
    Megaphone: Icon, Power: Icon, PowerOff: Icon, Plus: Icon, MapPin: Icon,
    Image: Icon, Video: Icon, Users: Icon, CheckCircle2: Icon, XCircle: Icon,
    Loader2: Icon, Sparkles: Icon, Camera: Icon, Globe2: Icon, Phone: Icon,
    Mail: Icon, ExternalLink: Icon, Eye: Icon, Pencil: Icon, Trash2: Icon,
    Info: Icon, Upload: Icon,
  }
})
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { TrouvetouAdminClient } from "./client"
import type { TrouvetouAd, TrouvetouReservation } from "./_lib/types"

const SCHOOL = {
  id: "s1",
  name: "Groupe Scolaire Les Palmiers",
  city: "Abidjan",
  published_to_trouvetou: false,
  description_publique: "Établissement familial.",
  latitude: 5.36,
  longitude: -4.006,
  itineraire: "",
  photos_360: [],
  video_url: "",
  grille_tarifaire_publique: null,
  cover_photo_url: "https://cdn.example.com/cover.jpg",
  gallery_photos: ["https://cdn.example.com/g1.jpg"],
  public_address: "Cocody Danga",
  public_phone: "+2250700000001",
  public_email: "contact@palmiers.ci",
  public_website_url: "",
  public_highlights: ["Cantine", "Transport"],
  admission_notes: "Rentrée en septembre.",
}

const A_RESERVATION = {
  id: "r1",
  student_full_name: "Awa Koné",
  parent_full_name: "Bintou Koné",
  parent_phone: "0700000001",
  status: "pending_payment",
  created_at: "2026-09-18T09:00:00.000Z",
  grade_level_id: null,
}

const AN_AD = {
  id: "ad1",
  title: "Rentrée 2026",
  message: "Inscriptions ouvertes",
  image_url: null,
  target_url: null,
  start_date: "2026-09-01",
  end_date: "2026-09-30",
  is_active: true,
  created_at: "2026-08-20T08:00:00.000Z",
}

type RenderOverrides = {
  school?: typeof SCHOOL | null
  reservations?: unknown[]
  ads?: unknown[]
}

function renderClient(overrides: RenderOverrides = {}) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(
      <TrouvetouAdminClient
        school={overrides.school === undefined ? SCHOOL : overrides.school}
        reservations={(overrides.reservations ?? []) as TrouvetouReservation[]}
        ads={(overrides.ads ?? []) as TrouvetouAd[]}
      />,
    )
  })
  return { container, root }
}

function clickByText(container: HTMLElement, text: string) {
  const target = Array.from(container.querySelectorAll("button, [role='tab'], span")).find(
    (el) => el.textContent?.trim() === text,
  ) as HTMLElement | undefined
  if (!target) throw new Error(`Élément « ${text} » introuvable`)
  act(() => target.click())
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.clearAllMocks()
})

describe("TrouvetouAdminClient", () => {
  it("affiche l'état de publication et le nom de l'établissement", () => {
    const { container, root } = renderClient()
    expect(container.textContent).toContain("Groupe Scolaire Les Palmiers")
    expect(container.textContent).toContain("Brouillon")
    expect(container.textContent).not.toContain("Publié")
    act(() => root.unmount())
  })

  it("affiche « Publié » quand l'établissement est publié", () => {
    const { container, root } = renderClient({
      school: { ...SCHOOL, published_to_trouvetou: true },
    })
    expect(container.textContent).toContain("Publié")
    act(() => root.unmount())
  })

  it("expose la photo de couverture avec une alternative textuelle", () => {
    const { container, root } = renderClient()
    const cover = Array.from(container.querySelectorAll("img")).find(
      (image) => image.alt === "Photo principale de l'établissement",
    )
    expect(cover).toBeDefined()
    expect(cover?.getAttribute("src")).toBe(SCHOOL.cover_photo_url)
    act(() => root.unmount())
  })

  it("calcule la complétude du profil (éléments renseignés + pourcentage)", () => {
    const { container, root } = renderClient()
    // Checks : cover ✔, description ✔, localisation ✔ (adresse), contact ✔
    // (téléphone), galerie ✔, vidéo ✘, points forts ✔, admission ✔ = 7/8.
    expect(container.textContent).toContain("7/8 éléments renseignés")
    expect(container.textContent).toContain("88%")
    act(() => root.unmount())
  })

  it("compte les demandes et publicités dans les onglets", () => {
    const { container, root } = renderClient({
      reservations: [A_RESERVATION],
      ads: [AN_AD],
    })
    expect(container.textContent).toContain("Demandes (1)")
    expect(container.textContent).toContain("Publicités (1)")
    act(() => root.unmount())
  })

  it("liste les demandes reçues avec le statut traduit", () => {
    const { container, root } = renderClient({ reservations: [A_RESERVATION] })
    clickByText(container, "Demandes (1)")
    expect(container.textContent).toContain("Awa Koné")
    expect(container.textContent).toContain("Parent : Bintou Koné")
    expect(container.textContent).toContain("Attente paiement")
    act(() => root.unmount())
  })

  it("affiche les états vides des onglets Demandes et Publicités", () => {
    const { container, root } = renderClient()
    clickByText(container, "Demandes (0)")
    expect(container.textContent).toContain("Aucune demande pour le moment.")
    clickByText(container, "Publicités (0)")
    expect(container.textContent).toContain("Aucune publicité.")
    act(() => root.unmount())
  })

  it("liste les publicités avec leur état d'activation", () => {
    const { container, root } = renderClient({ ads: [AN_AD] })
    clickByText(container, "Publicités (1)")
    expect(container.textContent).toContain("Rentrée 2026")
    expect(container.textContent).toContain("Inscriptions ouvertes")
    expect(container.textContent).toContain("Active")
    act(() => root.unmount())
  })
})
