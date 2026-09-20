import { describe, expect, it } from "vitest"
import {
  ENTRY_PATH_PREFIXES,
  PUBLIC_PATH_PREFIXES,
  ROLE_HOME,
  isEntryPath,
  isPublicPath,
  isRoleAllowedPath,
  isStudentPortalPath,
  legacyRedirectFor,
  matchesPrefix,
  roleHome,
} from "./route-rules"

/**
 * Tests de non-régression du socle de routage.
 *
 * Ces règles ont déjà cassé la production une fois : le proxy renvoyait
 * /register-school, /enroll/* et /verify/* vers /login, rendant l'inscription
 * d'école et la pré-inscription publiques impossibles. Couverture ici.
 */

// Catalogue officiel des rôles (migration 20260908090000_tenancy_auth.sql).
const ROLE_CATALOG = [
  "direction",
  "secretariat",
  "compta",
  "caisse",
  "professeur",
  "surveillance",
  "parent",
  "eleve",
] as const

describe("isPublicPath — tunnels publics", () => {
  it.each([
    "/login",
    "/register-school",
    "/verify/ABC123",
    "/enroll/61ccee8e-f135-4223-b5ce-88a450142e22",
  ])("autorise %s sans session", (path) => {
    expect(isPublicPath(path)).toBe(true)
  })

  it.each(["/api/health", "/api/debug", "/_next/static/chunk.js"])(
    "laisse passer le chemin technique %s",
    (path) => {
      expect(isPublicPath(path)).toBe(true)
    }
  )

  it.each([
    "/dashboard",
    "/dashboard/direction",
    "/dashboard/finance",
    "/dashboard/billing",
    "/dashboard/caisse/history",
    "/dashboard/pedagogie/grades",
    "/dashboard/super-admin",
  ])("protège %s (session obligatoire)", (path) => {
    expect(isPublicPath(path)).toBe(false)
  })

  it("n'autorise pas un chemin qui commence par un préfixe public sans le suivre", () => {
    // /loginXYZ ne doit pas être confondu avec /login.
    expect(isPublicPath("/loginfoo")).toBe(false)
    expect(isPublicPath("/registered-school")).toBe(false)
    expect(isPublicPath("/verifications")).toBe(false)
  })

  it("protège explicitement les tunnels publics voisins des routes métier", () => {
    expect(isPublicPath("/register-school/admin")).toBe(true)
    expect(isPublicPath("/dashboard/direction/admissions")).toBe(false)
  })
})

describe("isEntryPath — écrans d'entrée", () => {
  it("reconnaît la racine et /login", () => {
    expect(isEntryPath("/")).toBe(true)
    expect(isEntryPath("/login")).toBe(true)
  })

  it("ne considère pas les tableaux de bord comme écrans d'entrée", () => {
    expect(isEntryPath("/dashboard/direction")).toBe(false)
    expect(isEntryPath("/dashboard")).toBe(false)
  })
})

describe("matchesPrefix", () => {
  it("matche l'égalité stricte et les sous-chemins", () => {
    expect(matchesPrefix("/enroll", ["/enroll"])).toBe(true)
    expect(matchesPrefix("/enroll/abc", ["/enroll"])).toBe(true)
    expect(matchesPrefix("/enrollment", ["/enroll"])).toBe(false)
  })

  it("retourne faux sur une liste vide", () => {
    expect(matchesPrefix("/dashboard", [])).toBe(false)
  })
})

describe("roleHome — table de routage par rôle (finding M4)", () => {
  it("couvre tous les rôles du catalogue sauf `parent`", () => {
    const missing = ROLE_CATALOG.filter((r) => r !== "parent" && !roleHome(r))
    expect(missing).toEqual([])
  })

  it("ne fabrique pas de destination pour `parent` (app PWA dédiée)", () => {
    expect(roleHome("parent")).toBeNull()
  })

  it("ne fabrique pas de destination pour un rôle inconnu ou absent", () => {
    expect(roleHome("role_inexistant")).toBeNull()
    expect(roleHome("")).toBeNull()
    expect(roleHome(null)).toBeNull()
    expect(roleHome(undefined)).toBeNull()
  })

  it("route chaque rôle staff vers sa surface métier, pas vers un parent interdit", () => {
    // `compta` et `secretariat` n'ont pas accès à `/dashboard/direction` dans
    // ROLE_ALLOWED_PATHS : les renvoyer à la racine direction produirait un
    // refus d'accès (voire une boucle) juste après connexion.
    expect(roleHome("compta")).toBe("/dashboard/direction/finance")
    expect(roleHome("secretariat")).toBe("/dashboard/direction/admissions")
    expect(roleHome("surveillance")).toBe("/dashboard/pedagogie")
  })

  it("envoie chaque rôle vers une surface qui lui est réellement autorisée", () => {
    // Incohérences connues, hors périmètre de ce lot :
    // - `eleve` : portail hors /dashboard, règles distinctes ;
    // - `surveillance` : la seule surface autorisée est
    //   `/dashboard/pedagogie/vie-scolaire`, un module pas encore implémenté
    //   (ni route, ni page). Son accueil `/dashboard/pedagogie` n'est donc pas
    //   autorisé par le middleware : le surveillant est renvoyé au login après
    //   connexion. À réparer quand le module « vie scolaire » sera livré — le
    //   corriger ici reviendrait à ouvrir tout `/dashboard/pedagogie` (notes,
    //   appels, bulletins) au surveillant, ce qui élargirait ses droits.
    const known = new Set(["eleve", "surveillance"])
    for (const [role, home] of Object.entries(ROLE_HOME)) {
      if (known.has(role)) continue
      expect(isRoleAllowedPath(role, home)).toBe(true)
    }
  })

  it("n'envoie jamais un rôle vers /login (boucle de connexion)", () => {
    const homes = Object.values(ROLE_HOME)
    expect(homes).not.toContain("/login")
  })

  it("les rôles staff sont servis sous /dashboard (layout = garde session)", () => {
    for (const [role, home] of Object.entries(ROLE_HOME)) {
      if (role === "eleve") continue
      expect(home.startsWith("/dashboard/")).toBe(true)
    }
  })

  it("le portail élève reste HORS de /dashboard (layout staff exige une session)", () => {
    expect(ROLE_HOME.eleve).toBe("/eleve")
    expect(ROLE_HOME.eleve.startsWith("/dashboard")).toBe(false)
  })
})

describe("isRoleAllowedPath — cloisonnement inter-rôles du middleware", () => {
  it("autorise un professeur à saisir des notes", () => {
    expect(isRoleAllowedPath("professeur", "/dashboard/pedagogie/grades")).toBe(true)
    expect(isRoleAllowedPath("professeur", "/dashboard/pedagogie/grades/notes")).toBe(true)
  })

  it("refuse au professeur les actes officiels de fin d'année", () => {
    // `report-cards` fige la décision annuelle et publie aux familles :
    // responsabilité de la direction, comme vie-scolaire l'est au surveillant.
    expect(isRoleAllowedPath("professeur", "/dashboard/pedagogie/grades/report-cards")).toBe(false)
  })

  it("refuse toujours le sous-espace de la surveillance", () => {
    expect(isRoleAllowedPath("professeur", "/dashboard/pedagogie/vie-scolaire")).toBe(false)
  })

  it("autorise la direction sur les deux écrans d'évaluation", () => {
    expect(isRoleAllowedPath("direction", "/dashboard/pedagogie/grades/notes")).toBe(true)
    expect(isRoleAllowedPath("direction", "/dashboard/pedagogie/grades/report-cards")).toBe(true)
  })

  it("refuse un rôle inconnu, absent ou une cible hors périmètre", () => {
    expect(isRoleAllowedPath("role_inexistant", "/dashboard/pedagogie")).toBe(false)
    expect(isRoleAllowedPath(null, "/dashboard/pedagogie")).toBe(false)
    expect(isRoleAllowedPath(undefined, "/dashboard/pedagogie")).toBe(false)
    expect(isRoleAllowedPath("professeur", "/dashboard/direction/finance")).toBe(false)
  })

  it("ne confond pas un préfixe autorisé avec son homonyme", () => {
    // `/dashboard/pedagogieX` n'est pas `/dashboard/pedagogie`.
    expect(isRoleAllowedPath("professeur", "/dashboard/pedagogieX")).toBe(false)
  })
})

describe("cohérence des constantes exportées", () => {
  it("n'expose pas de préfixe public menant au dashboard", () => {
    expect(PUBLIC_PATH_PREFIXES.some((p) => p.startsWith("/dashboard"))).toBe(false)
  })

  it("l'écran d'entrée est aussi un chemin public", () => {
    for (const entry of ENTRY_PATH_PREFIXES) {
      expect(isPublicPath(entry)).toBe(true)
    }
  })
})

describe("portail élève — surface autonome /eleve (audit P1-1)", () => {
  it("reconnaît le portail et ses sous-chemins", () => {
    expect(isStudentPortalPath("/eleve")).toBe(true)
    expect(isStudentPortalPath("/eleve/notes")).toBe(true)
  })

  it("ne confond pas le portail avec ses voisins ni avec l'ancienne URL", () => {
    expect(isStudentPortalPath("/eleves")).toBe(false)
    expect(isStudentPortalPath("/dashboard/eleve")).toBe(false) // URL legacy
    expect(isStudentPortalPath("/dashboard")).toBe(false)
  })

  it("redirige l'ancienne URL (QR imprimés, favoris) en conservant le sous-chemin", () => {
    expect(legacyRedirectFor("/dashboard/eleve")).toBe("/eleve")
    expect(legacyRedirectFor("/dashboard/eleve/notes")).toBe("/eleve/notes")
  })

  it("ne redirige rien d'autre que l'ancienne URL du portail", () => {
    expect(legacyRedirectFor("/dashboard")).toBeNull()
    expect(legacyRedirectFor("/dashboard/direction")).toBeNull()
    expect(legacyRedirectFor("/eleve")).toBeNull()
    expect(legacyRedirectFor("/dashboard/eleveX")).toBeNull()
  })
})