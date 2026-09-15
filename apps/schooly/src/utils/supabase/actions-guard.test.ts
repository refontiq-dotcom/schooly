import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Garde-fou anti-régression : chaque Server Action exportée des modules
 * sécurisés doit passer par un helper d'autorisation (requireSchoolRole /
 * teachingGuard / getContext) avant d'écrire ou de lire des données.
 *
 * Contexte (audit docs/security/audit-socle-auth-tenancy.md, finding P1-2) :
 * ~97 actions sur ~100 n'exécutaient AUCUN contrôle de rôle — un professeur
 * pouvait créer un barème de frais, un parent valider une pré-inscription.
 * Ce test rend la régression impossible au lieu de la dépister à l'œil.
 *
 * Périmètre : les modules effectivement sécurisés. Lorsqu'un nouveau module
 * est audité, l'ajouter à SECURITY_MODULES ; lorsqu'une action publique est
 * légitime, l'ajouter à PUBLIC_ACTIONS avec la justification.
 */

const SRC = join(process.cwd(), "apps/schooly/src/app/dashboard")

/** Modules couverts par la garantie « toute action a une garde ». */
const SECURITY_MODULES: Array<{
  file: string
  guards: RegExp
  /** Filtrage par rôle attendu quelque part dans le module (helper local). */
  mustContain?: RegExp
}> = [
  {
    file: "pedagogie/actions.ts",
    guards: /requireSchoolRole\(|teachingGuard\(/,
  },
  { file: "admissions/actions.ts", guards: /requireSchoolRole\(/ },
  { file: "finance/actions.ts", guards: /requireSchoolRole\(/ },
  { file: "finance/moratoriums/actions.ts", guards: /requireSchoolRole\(/ },
  {
    file: "direction/onboarding-actions.ts",
    // Garde locale antérieure au helper central : l'action doit déléguer à
    // resolveSchoolId(), lequel filtre explicitement sur SETUP_ROLES (vérifié
    // par la règle mustContain du module) — équivalent en garantie.
    guards: /resolveSchoolId\(/,
    mustContain: /in\("role_code", SETUP_ROLES\)/,
  },
  // Le rollover utilise son propre helper (contexte + whitelist de rôles).
  { file: "academic-structure/rollover-actions.ts", guards: /await getContext\(\)/ },
]

/**
 * Actions publiquement invocables, par conception :
 * chaque entrée doit être justifiée — une exception non listée fait échouer
 * le test, une exception obsolète doit être retirée.
 */
const PUBLIC_ACTIONS: ReadonlyArray<{ action: string; because: string }> = [
  {
    action: "createPreEnrollment",
    because: "tunnel public /enroll/[schoolId] — le parent n'a pas de compte",
  },
  {
    action: "verifyReceipt",
    because: "tunnel public /verify/[code] — secret = code non énumérable",
  },
]

// Découpe d'un module en corps d'actions exportées.
function exportedActions(source: string): Array<{ name: string; body: string }> {
  return source
    .split(/\nexport async function\s+/)
    .slice(1)
    .map((chunk) => ({
      name: (chunk.match(/^\w+/) ?? ["<inconnu>"])[0],
      body: chunk,
    }))
}

describe("Server Actions : chaque action passe par une garde d'autorisation", () => {
  it.each(SECURITY_MODULES.map((m) => [m.file, m] as const))(
    "%s",
    (_file, module) => {
      const source = readFileSync(join(SRC, module.file), "utf-8")
      const actions = exportedActions(source)
      // Sanity check : un module qui n'expose plus rien est un signal d'erreur
      // (fichier renommé, regex cassée) — pas une réussite silencieuse.
      expect(actions.length).toBeGreaterThan(0)

      const unguarded = actions.filter(
        (a) =>
          !module.guards.test(a.body) &&
          !PUBLIC_ACTIONS.some((p) => p.action === a.name)
      )
      expect(unguarded.map((a) => a.name)).toEqual([])

      if (module.mustContain) {
        expect(module.mustContain.test(source)).toBe(true)
      }
    }
  )

  it("les exceptions publiques existent toujours dans leur module", () => {
    const admissions = readFileSync(join(SRC, "admissions/actions.ts"), "utf-8")
    const finance = readFileSync(join(SRC, "finance/actions.ts"), "utf-8")
    expect(admissions).toContain(
      `export async function ${PUBLIC_ACTIONS[0].action}`
    )
    expect(finance).toContain(
      `export async function ${PUBLIC_ACTIONS[1].action}`
    )
  })

  it("la liste des exceptions publiques est justifiée (pas d'exception orpheline)", () => {
    for (const entry of PUBLIC_ACTIONS) {
      expect(entry.because).toMatch(/\S/)
    }
  })
})