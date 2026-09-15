import { describe, expect, it } from "vitest"
import {
  ENTRY_PATH_PREFIXES,
  PUBLIC_PATH_PREFIXES,
  ROLE_HOME,
  isEntryPath,
  isPublicPath,
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
  "super_admin",
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

  it("route les rôles staff manquants du proxy vers l'espace direction", () => {
    expect(roleHome("compta")).toBe("/dashboard/direction")
    expect(roleHome("secretariat")).toBe("/dashboard/direction")
    expect(roleHome("surveillance")).toBe("/dashboard/pedagogie")
  })

  it("n'envoie jamais un rôle vers /login (boucle de connexion)", () => {
    const homes = Object.values(ROLE_HOME)
    expect(homes).not.toContain("/login")
    expect(homes.every((h) => h.startsWith("/dashboard/"))).toBe(true)
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