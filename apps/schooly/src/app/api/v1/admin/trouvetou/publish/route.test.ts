// apps/schooly/src/app/api/v1/admin/trouvetou/publish/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Test du CHEMIN RÉEL de publication vers Trouvetou.
 *
 * Ce que ce fichier prouve, et qui n'était prouvé par aucun test jusqu'ici :
 * que la route de publication lit `school_media`, ne retient que les visites
 * `published`, et les inscrit dans le champ `panoramas` du payload envoyé à
 * Trouvetou. Avant, `toTrouvetouMediaContract()` n'était exercé que par son
 * propre test unitaire — la fonction était correcte mais jamais appelée.
 *
 * Seules les DEUX frontières sont simulées : la base (client Supabase) et le
 * réseau (`fetch` vers Trouvetou). Entre les deux, la route s'exécute pour de
 * vrai : c'est le corps réellement émis qui est capturé et vérifié.
 */

type MediaRow = {
  id: string
  status: string
  r2_key: string
  public_url: string
  width: number | null
  height: number | null
  byte_size: number | null
  content_type: string | null
  room_id: string | null
  validated_at: string | null
  kind?: string
  school_id?: string
}

/** Lignes que la base retourne pour `school_media`. */
let mediaRows: MediaRow[] = []
/** Corps réellement émis vers Trouvetou. */
let emittedPayload: { school: Record<string, unknown> } | null = null

function chain(result: unknown) {
  const node: Record<string, unknown> = {}
  for (const method of ["select", "eq", "is", "in", "order", "limit", "update", "insert"]) {
    node[method] = vi.fn(() => node)
  }
  node.single = vi.fn(async () => ({ data: result, error: null }))
  node.maybeSingle = vi.fn(async () => ({ data: result, error: null }))
  // Toute attente sur la chaîne renvoie le même encadrement que les méthodes
  // terminales : c'est bien `{ data, error }` que la route déstructure.
  node.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result, error: null }).then(resolve)
  return node
}

/**
 * Chaîne `.from("school_media").select().eq()…`.
 *
 * Les filtres `.eq()` / `.is()` sont RÉELLEMENT appliqués, comme le fait
 * PostgREST. Sans cela, un test « panorama `validated` → publication refusée »
 * ne prouverait rien : le double renverrait la ligne malgré le
 * `.eq("status", "published")`, et la route croirait le média publiable. Le
 * filtre en base étant justement ce qui protège la règle, le double doit le
 * reproduire fidèlement.
 */
function mediaChain() {
  const filters: Record<string, unknown> = {}
  const node: Record<string, unknown> = {}
  const apply = () =>
    mediaRows.filter((row) =>
      Object.entries(filters).every(([column, value]) => row[column as keyof MediaRow] === value),
    )

  for (const method of ["select", "order", "limit"]) node[method] = vi.fn(() => node)
  node.eq = vi.fn((column: string, value: unknown) => {
    filters[column] = value
    return node
  })
  node.is = vi.fn((column: string, value: unknown) => {
    filters[column] = value
    return node
  })
  // Comme pour les autres tables, Supabase encadre le résultat dans
  // `{ data, error }` : renvoyer le tableau nu ferait lire `data` à undefined
  // et le payload partirait sans aucun panorama.
  node.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: apply(), error: null }).then(resolve)
  return node
}

const SCHOOL = {
  id: "s1",
  name: "École Test",
  city: "Abidjan",
  latitude: 5.3,
  longitude: -4.0,
  description_publique: "Une école.",
  itineraire: null,
  photos_360: ["https://pub.r2.dev/legacy-360.jpg"],
  video_url: null,
  grille_tarifaire_publique: [],
  cover_photo_url: "https://cdn.exemple/cover.jpg",
  gallery_photos: ["https://cdn.exemple/1.jpg", "https://cdn.exemple/2.jpg"],
  public_address: "Cocody",
  public_phone: "+2250700000000",
  public_email: "contact@exemple.ci",
  public_website_url: null,
  public_highlights: [],
  admission_notes: null,
}

/**
 * Fiche `schools` courante, mutée par les tests d'éligibilité.
 *
 * Une seule variable alimente la fiche complète ET le contrôle de publication :
 * c'est ainsi que se comporte la vraie base, où ce sont les mêmes colonnes.
 */
let schoolRow: Record<string, unknown>

const MEDIA_PUBLIE: MediaRow = {
  id: "11111111-1111-1111-1111-111111111111",
  // `kind` et `school_id` ne servaient à rien tant que le double ignorait les
  // filtres. Ils font désormais partie de la sélection : une ligne d'un autre
  // `kind`, ou d'un autre établissement, ne doit surtout pas passer.
  kind: "panorama_360",
  school_id: "s1",
  status: "published",
  r2_key: "schooly/production/360/s1/1111.jpg",
  public_url: "https://pub.r2.dev/schooly/production/360/s1/1111.jpg",
  width: 6000,
  height: 3000,
  byte_size: 4200000,
  content_type: "image/jpeg",
  room_id: null,
  validated_at: "2026-09-28T10:00:00.000Z",
}

function adminClient() {
  return {
    from: (table: string) => {
      if (table === "school_media") return mediaChain()
      if (table === "user_school_roles") {
        return chain({ school_id: "s1", role_code: "proprietaire" })
      }
      if (table === "grade_levels") {
        return chain([
          { id: "n1", name: "6e" },
          { id: "n2", name: "5e" },
        ])
      }
      if (table === "schools") {
        // Trois usages : la fiche complète, le contrôle de publication, et
        // les mises à jour de `published_to_trouvetou`. Une seule variable
        // mutate les trois, comme la vraie base : la fiche lue pour décider
        // est celle qui est ensuite synchronisée.
        return chain(schoolRow)
      }
      return chain(null)
    },
  }
}

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } }),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => adminClient(),
}))

vi.mock("@/utils/supabase/roles", () => ({ TROUVETOU_ADMIN_ROLES: ["proprietaire"] }))

/** Capture le corps réellement transmis à Trouvetou. */
function mockTrouvetouFetch() {
  return vi.fn(async (_url: string, init: { body: string }) => {
    emittedPayload = JSON.parse(init.body)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  })
}

const { POST } = await import("./route")

async function publier() {
  emittedPayload = null
  process.env.TROUVETOU_API_KEY = "tv_live_cle-de-test"
  globalThis.fetch = mockTrouvetouFetch() as unknown as typeof fetch

  const res = await POST(
    new Request("http://localhost/api/v1/admin/trouvetou/publish", {
      method: "POST",
      body: JSON.stringify({ published: true }),
    }),
  )
  // Le corps de la réponse est renvoyé : un échec affiche alors la VRAIE
  // cause (« Erreur de synchronisation »), pas seulement un 502 muet.
  const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string }
  return { status: res.status, payload: emittedPayload, body }
}

const school = () => (emittedPayload?.school ?? {}) as Record<string, unknown>
const panoramas = () => (school().panoramas ?? []) as Array<Record<string, unknown>>

beforeEach(() => {
  mediaRows = []
  emittedPayload = null
  schoolRow = { ...SCHOOL }
})

describe("publication Trouvetou — champ panoramas", () => {
  it("1. établissement sans panorama : le payload reste strictement identique", async () => {
    mediaRows = []
    const { status, payload, body } = await publier()

    expect(body.details ?? body.error).toBeUndefined()
    expect(status).toBe(200)
    expect(payload).not.toBeNull()
    // Le champ existe et est vide : Trouvetou lit « aucune visite », ce qui
    // laisse la galerie classique intacte.
    expect(panoramas()).toEqual([])
  })

  it("1 bis. sans panorama, les photos classiques partent exactement comme avant", async () => {
    await publier()

    // Régression : ces trois champs ne doivent avoir changé ni de nom, ni de
    // valeur, ni d'ordinal. Le contrat §12.1 l'impose (« rien n'est retiré ni
    // renommé »).
    expect(school().cover_photo).toBe(SCHOOL.cover_photo_url)
    expect(school().gallery).toEqual(SCHOOL.gallery_photos)
    expect(school().photos_360).toEqual(SCHOOL.photos_360)
  })

  it("2. un panorama publié apparaît dans panoramas, au contrat attendu", async () => {
    mediaRows = [MEDIA_PUBLIE]
    const { status } = await publier()

    expect(status).toBe(200)
    expect(panoramas()).toHaveLength(1)
    expect(panoramas()[0]).toEqual({
      id: MEDIA_PUBLIE.id,
      media_type: "photo_360",
      url: MEDIA_PUBLIE.public_url,
      width: 6000,
      height: 3000,
      byte_size: 4200000,
      content_type: "image/jpeg",
      room_id: null,
      projection: "equirectangular_2_1",
      validated_at: "2026-09-28T10:00:00.000Z",
    })
  })

  it("3. un média non publié ne part jamais, quel que soit son statut", async () => {
    for (const status of ["uploaded", "validated", "rejected"]) {
      mediaRows = [{ ...MEDIA_PUBLIE, status }]
      await publier()
      expect(panoramas(), `statut ${status}`).toEqual([])
    }
  })

  it("4. photos classiques et panorama sont conservés ensemble", async () => {
    mediaRows = [MEDIA_PUBLIE]
    await publier()

    // Le panorama s'ajoute, il ne remplace rien.
    expect(school().cover_photo).toBe(SCHOOL.cover_photo_url)
    expect(school().gallery).toHaveLength(2)
    expect(school().photos_360).toHaveLength(1)
    expect(panoramas()).toHaveLength(1)
  })

  it("5. plusieurs panoramas publiés sont tous transmis, sans doublon", async () => {
    mediaRows = [
      MEDIA_PUBLIE,
      { ...MEDIA_PUBLIE, id: "22222222-2222-2222-2222-222222222222", public_url: "https://pub.r2.dev/b.jpg" },
      { ...MEDIA_PUBLIE, id: "33333333-3333-3333-3333-333333333333", public_url: "https://pub.r2.dev/c.jpg" },
    ]
    await publier()

    expect(panoramas()).toHaveLength(3)
    const ids = panoramas().map((p) => p.id)
    expect(new Set(ids).size).toBe(3)
  })

  it("6. une réexécution de la publication produit un payload identique", async () => {
    mediaRows = [MEDIA_PUBLIE]
    await publier()
    const premier = JSON.stringify(school().panoramas)

    mediaRows = [MEDIA_PUBLIE]
    await publier()

    expect(panoramas()).toHaveLength(1)
    expect(JSON.stringify(school().panoramas)).toBe(premier)
  })

  it("7. un panorama dépublié disparaît du payload suivant", async () => {
    mediaRows = [MEDIA_PUBLIE]
    await publier()
    expect(panoramas()).toHaveLength(1)

    // La publication d'une autre visite repasse l'ancienne en `validated`
    // (index unique `uniq_school_media_published_panorama`) : la base ne
    // renvoie alors plus qu'elle.
    mediaRows = [{ ...MEDIA_PUBLIE, id: "44444444-4444-4444-4444-444444444444" }]
    await publier()

    expect(panoramas()).toHaveLength(1)
    expect(panoramas()[0].id).toBe("44444444-4444-4444-4444-444444444444")
  })

  it("8. room_id est transmis tel quel, jamais transformé", async () => {
    // Aucun établissement de Schooly n'a de visite rattachée aujourd'hui, mais
    // le contrat prévoit le cas : l'identifiant Schooly part opaque, Trouvetou
    // n'a pas à le comprendre pour l'afficher.
    mediaRows = [{ ...MEDIA_PUBLIE, room_id: "dorm-uuid-1" }]
    await publier()

    expect(panoramas()[0].room_id).toBe("dorm-uuid-1")
  })
})

// ---------------------------------------------------------------------------
// Éligibilité : un établissement est publiable s'il possède AU MOINS un média
// publiable — une photo classique, OU une visite 360° `published`.
//
// Ces tests sont la raison d'être de la correction. Avant, la condition ne
// regardait que `cover_photo_url || gallery_photos || photos_360` : un
// établissement doté d'un panorama 360° publié se voyait refuser sa
// publication alors même que son panorama partait bien vers Trouvetou.
//
// SIMULÉS : `fetch` vers Trouvetou et le client Supabase sont les seules
// doublures. La route s'exécute pour de vrai entre les deux.
// ---------------------------------------------------------------------------

/** Retire toute photo classique, sans rien changer d'autre. */
function sansPhotoClassique() {
  schoolRow.cover_photo_url = null
  schoolRow.gallery_photos = []
  schoolRow.photos_360 = []
}

describe("éligibilité — photos classiques", () => {
  it("A. photo principale seule : publication autorisée", async () => {
    schoolRow.cover_photo_url = "https://cdn.exemple/cover.jpg"
    schoolRow.gallery_photos = []
    schoolRow.photos_360 = []
    mediaRows = []

    const { status } = await publier()
    expect(status).toBe(200)
  })

  it("A bis. galerie seule : publication autorisée", async () => {
    schoolRow.cover_photo_url = null
    schoolRow.gallery_photos = ["https://cdn.exemple/1.jpg"]
    schoolRow.photos_360 = []
    mediaRows = []

    const { status } = await publier()
    expect(status).toBe(200)
  })
})

describe("éligibilité — panorama 360°", () => {
  it("B. panorama publié seul, sans aucune photo : publication AUTORISÉE", async () => {
    sansPhotoClassique()
    mediaRows = [MEDIA_PUBLIE]

    const { status, payload } = await publier()
    expect(status).toBe(200)
    expect(payload).not.toBeNull()
    // Le média qui a débloqué la publication est bien celui qui est transmis.
    expect(panoramas()).toHaveLength(1)
    expect(panoramas()[0].id).toBe(MEDIA_PUBLIE.id)
  })

  it("C. photo classique ET panorama publié : les deux voyagent ensemble", async () => {
    schoolRow.cover_photo_url = "https://cdn.exemple/cover.jpg"
    schoolRow.gallery_photos = ["https://cdn.exemple/1.jpg"]
    mediaRows = [MEDIA_PUBLIE]

    const { status } = await publier()
    expect(status).toBe(200)
    expect(panoramas()).toHaveLength(1)
    expect(school().cover_photo).toBe("https://cdn.exemple/cover.jpg")
  })

  it("D. panorama seulement `validated` : publication REFUSÉE", async () => {
    sansPhotoClassique()
    mediaRows = [{ ...MEDIA_PUBLIE, status: "validated" }]

    const { status, body, payload } = await publier()
    expect(status).toBe(400)
    expect(body.error).toMatch(/Publication impossible/)
    expect(payload).toBeNull()
  })

  it("E. panorama seulement `uploaded` : publication REFUSÉE", async () => {
    sansPhotoClassique()
    mediaRows = [{ ...MEDIA_PUBLIE, status: "uploaded" }]

    const { status, payload } = await publier()
    expect(status).toBe(400)
    expect(payload).toBeNull()
  })

  it("F. panorama seulement `rejected` : publication REFUSÉE", async () => {
    sansPhotoClassique()
    mediaRows = [{ ...MEDIA_PUBLIE, status: "rejected" }]

    const { status, payload } = await publier()
    expect(status).toBe(400)
    expect(payload).toBeNull()
  })

  it("G. aucun média du tout : publication REFUSÉE", async () => {
    sansPhotoClassique()
    mediaRows = []

    const { status, body, payload } = await publier()
    expect(status).toBe(400)
    expect(body.error).toMatch(/Publication impossible/)
    expect(payload).toBeNull()
  })

  it("D bis. des panoramas non publiés ne débloquent rien, même en mélange", async () => {
    sansPhotoClassique()
    mediaRows = [
      { ...MEDIA_PUBLIE, id: "aaaa", status: "rejected" },
      { ...MEDIA_PUBLIE, id: "bbbb", status: "validated" },
      { ...MEDIA_PUBLIE, id: "cccc", status: "uploaded" },
    ]

    const { status } = await publier()
    expect(status).toBe(400)
  })
})


// ---------------------------------------------------------------------------
// Capture du payload RÉEL, pour le test de contrat côté Trouvetou.
//
// Ce test ne sert pas à valider une logique : il écrit, sur disque, le corps
// exact que la route envoie à Trouvetou. Le test de contrat de l'ingestion
// Trouvetou s'en sert comme entrée, ce qui prouve que les deux dépôts
// calendrier sur le même format — sans les relier par un réseau factice.
// ---------------------------------------------------------------------------
import { writeFileSync, mkdirSync } from "node:fs"

describe("capture du payload émis", () => {
  it("écrit le payload réel sur disque", async () => {
    mediaRows = [MEDIA_PUBLIE]
    const { status, payload } = await publier()
    expect(status).toBe(200)

    mkdirSync("/tmp/contrat", { recursive: true })
    writeFileSync("/tmp/contrat/payload-trouvetou.json", JSON.stringify(payload, null, 2))
    // Le transtypage explicite évite que TypeScript réduise `payload` à
    // `never` : la variable est remise à `null` au début de `publier()`, et il
    // ne voit pas la réassignation faite par la route.
    const capture = payload as { school?: unknown } | null
    expect(capture?.school).toBeDefined()
  })

// ---------------------------------------------------------------------------
// La condition doit reposer sur `school_media` filtré, jamais sur la simple
// présence d'une ligne. Ces tests verrouillent ce point : un média publié mais
// d'un autre `kind` ou d'un autre établissement ne débloque rien, et seul
// `published` ouvre la porte.
// ---------------------------------------------------------------------------

describe("éligibilité — la source de vérité est school_media filtré", () => {
  it("une ligne `published` d'un AUTRE kind ne débloque pas la publication", async () => {
    // Piège : une photo de galerie stockée dans `school_media` est bien
    // `published`, mais son `kind` n'est pas `panorama_360`.
    sansPhotoClassique()
    mediaRows = [{ ...MEDIA_PUBLIE, kind: "gallery_photo" }]

    const { status } = await publier()
    expect(status).toBe(400)
  })

  it("une ligne `published` d'un AUTRE établissement ne débloque pas la publication", async () => {
    sansPhotoClassique()
    mediaRows = [{ ...MEDIA_PUBLIE, school_id: "autre-ecole" }]

    const { status } = await publier()
    expect(status).toBe(400)
  })

  it("`published` est le SEUL statut qui débloque", async () => {
    const resultats: Record<string, number> = {}

    for (const statut of ["uploaded", "validated", "rejected", "published"]) {
      sansPhotoClassique()
      mediaRows = [{ ...MEDIA_PUBLIE, status: statut }]
      resultats[statut] = (await publier()).status
    }

    expect(resultats).toEqual({ uploaded: 400, validated: 400, rejected: 400, published: 200 })
  })

  it("H. `photos_360` reste pris en compte : la règle historique est préservée", async () => {
    // Décision volontaire, et non un oubli. `photos_360` fait partie de la
    // DÉFINITION historique des photos classiques, qui a été demandé comme
    // inchangée : la retirer modifierait le comportement d'un établissement
    // qui a publié avant le nouveau parcours.
    //
    // Elle ne sert en revanche PLUS à conclure qu'un panorama 360° existe :
    // cette question est posée uniquement à `school_media`. Le champ continue
    // d'arriver tel quel dans le payload, à côté de `panoramas`.
    sansPhotoClassique()
    schoolRow.photos_360 = ["https://pub.r2.dev/ancienne-360.jpg"]
    mediaRows = []

    const { status } = await publier()
    expect(status).toBe(200)
    // …mais aucun panorama n'est émis : la machine d'état reste la seule
    // source de vérité du nouveau parcours.
    expect(panoramas()).toHaveLength(0)
  })

  it("H bis. le payload conserve `photos_360` EN PLUS du nouveau `panoramas`", async () => {
    // Non-régression du contrat : `photos_360` garde sa place historique, à côté
    // de `panoramas` et jamais à sa place.
    schoolRow.photos_360 = ["https://pub.r2.dev/ancienne-360.jpg"]
    mediaRows = [MEDIA_PUBLIE]

    const { status } = await publier()
    expect(status).toBe(200)
    expect(school().photos_360).toEqual(["https://pub.r2.dev/ancienne-360.jpg"])
    expect(panoramas()).toHaveLength(1)
  })
})

})
