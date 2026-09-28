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
import type { SchoolPanorama, TrouvetouAd, TrouvetouReservation } from "./_lib/types"

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
  contact_phone: "+2250700000001",
  cta_label: "En savoir plus",
  start_date: "2026-09-01",
  end_date: "2026-09-30",
  duration_days: 30,
  daily_rate: 700,
  total_amount: 21000,
  payment_status: "active",
  is_active: true,
  created_at: "2026-08-20T08:00:00.000Z",
}

type RenderOverrides = {
  school?: typeof SCHOOL | null
  reservations?: unknown[]
  ads?: unknown[]
  panorama?: SchoolPanorama | null
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
        panorama={overrides.panorama ?? null}
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

  it("liste les publicités avec leur tarif et leur état d'activation", () => {
    const { container, root } = renderClient({ ads: [AN_AD] })
    clickByText(container, "Publicités (1)")
    expect(container.textContent).toContain("Rentrée 2026")
    expect(container.textContent).toContain("Inscriptions ouvertes")
    expect(container.textContent).toContain("30 jour(s)")
    expect(container.textContent).toContain("FCFA")
    expect(container.textContent).toContain("Active")
    act(() => root.unmount())
  })

// ---------------------------------------------------------------------------
// Éligibilité à la publication, côté interface.
//
// Ces tests prouvent que le garde-fou du DASHBOARD suit la même règle que la
// route. Sans eux, corriger la route n'aurait rien changé pour l'utilisateur :
// le bouton resterait désactivé et la requête ne partirait jamais.
// ---------------------------------------------------------------------------

const panorama = (status: SchoolPanorama["status"]): SchoolPanorama => ({
  id: "med-1",
  status,
  public_url: "https://cdn.example.com/pano.jpg",
  width: 6000,
  height: 3000,
  byte_size: 6 * 1024 * 1024,
  rejection_code: status === "rejected" ? "torn_seam" : null,
  rejection_details: null,
  published_at: status === "published" ? "2026-09-20T10:00:00.000Z" : null,
})

/** Établissement sans aucune photo classique. */
const SANS_PHOTO = {
  ...SCHOOL,
  cover_photo_url: "",
  gallery_photos: [],
  photos_360: [],
}

function banniereEligibilite(container: HTMLElement) {
  return container.textContent?.includes("Publication impossible pour le moment") ?? false
}

/**
 * Le bouton qui applique vraiment la règle vit dans le modal « Publication »,
 * monté par Radix dans un portail : il n'est ni dans `container` ni rendu tant
 * que le modal est fermé. On l'atteint donc en ouvrant le modal depuis
 * l'en-tête, puis en interrogeant `document.body`.
 */
function ouvrirModalPublication(container: HTMLElement) {
  const entete = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Publier sur Trouvetou"),
  ) as HTMLButtonElement
  act(() => entete.click())
}

function boutonConfirmerPublication(): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll("button")).filter((b) =>
    b.textContent?.includes("Publier sur Trouvetou"),
  )
  return found[found.length - 1]
}

describe("éligibilité à la publication — photos classiques", () => {
  it("bloque la publication sans photo ni panorama", () => {
    const { container, root } = renderClient({ school: SANS_PHOTO })
    expect(banniereEligibilite(container)).toBe(true)
    expect(container.textContent).toContain("La fiche ne peut pas être publiée sans photo")

    ouvrirModalPublication(container)
    expect(boutonConfirmerPublication().disabled).toBe(true)
    act(() => root.unmount())
  })

  it("autorise la publication dès qu'une photo classique existe", () => {
    const { container, root } = renderClient({ school: { ...SANS_PHOTO, cover_photo_url: "https://cdn/x.jpg" } })
    expect(banniereEligibilite(container)).toBe(false)

    ouvrirModalPublication(container)
    expect(boutonConfirmerPublication().disabled).toBe(false)
    act(() => root.unmount())
  })
})

describe("éligibilité à la publication — panorama 360°", () => {
  it("un panorama `published` débloque la publication sans aucune photo", () => {
    const { container, root } = renderClient({ school: SANS_PHOTO, panorama: panorama("published") })
    expect(banniereEligibilite(container)).toBe(false)
    // Le message de l'état vide ne doit plus promettre le blocage.
    expect(container.textContent).toContain("peut déjà être publiée avec ta photo 360°")

    ouvrirModalPublication(container)
    expect(boutonConfirmerPublication().disabled).toBe(false)
    act(() => root.unmount())
  })

  it.each(["uploaded", "validated", "rejected"] as const)(
    "un panorama `%s` ne débloque PAS la publication",
    (status) => {
      const { container, root } = renderClient({ school: SANS_PHOTO, panorama: panorama(status) })
      expect(banniereEligibilite(container)).toBe(true)

      ouvrirModalPublication(container)
      expect(boutonConfirmerPublication().disabled).toBe(true)
      act(() => root.unmount())
    },
  )
})

})
