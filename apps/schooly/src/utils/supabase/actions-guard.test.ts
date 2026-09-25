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
 * légitime, l'ajouter à PUBLIC_ACTIONS avec la justification. Exception
 * d'école : le portail élève (P1-1) — son modèle d'auth est le cookie QR,
 * la garantie y porte sur la manipulation explicite de ce cookie.
 */

// Base des modules surveillés : toute l'arborescence app/ (le portail élève
// vit hors de dashboard/, cf. audit P1-1).
const SRC = join(process.cwd(), "apps/schooly/src/app")

/** Modules couverts par la garantie « toute action a une garde ». */
const SECURITY_MODULES: Array<{
  file: string
  guards: RegExp
  /** Invariant attendu quelque part dans le module (helper local). */
  mustContain?: RegExp
}> = [
  {
    file: "dashboard/pedagogie/actions.ts",
    guards: /requireSchoolRole\(|teachingGuard\(/,
  },
  // A1 : les anciens monolithes sont des façades. La garantie porte désormais
  // sur chaque implémentation serveur spécialisée, pas sur le fichier de réexport.
  { file: "dashboard/admissions/pre-enrollments.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/admissions/counter-enrollments.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/admissions/people.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/admissions/enrollments.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/admissions/financial-profiles.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/admissions/directory.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/finance/fee-schedules.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/finance/payments.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/finance/cash.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/finance/receipts.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/finance/accounting.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/finance/balances.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/finance/discounts.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/finance/reminders.ts", guards: /requireSchoolRole\(/ },
  { file: "dashboard/finance/moratoriums/actions.ts", guards: /requireSchoolRole\(/ },
  {
    file: "dashboard/direction/onboarding-actions.ts",
    // Garde locale antérieure au helper central : l'action doit déléguer à
    // resolveSchoolId(), lequel filtre explicitement sur SETUP_ROLES (vérifié
    // par la règle mustContain du module) — équivalent en garantie.
    guards: /resolveSchoolId\(/,
    mustContain: /in\("role_code", SETUP_ROLES\)/,
  },
  // Le rollover utilise son propre helper (contexte + whitelist de rôles).
  { file: "dashboard/academic-structure/rollover-actions.ts", guards: /await getContext\(\)/ },
  {
    // Portail élève (audit P1-1) : modèle d'authentification différent — la
    // session EST le cookie httpOnly posé après validation du code QR (secret
    // non énumérable), et chaque lecture DB revérifie l'état du code. Garantie
    // statique : chaque action manipule explicitement ce cookie, et le module
    // vérifie bien l'état is_active du QR (révocable par la vie scolaire).
    file: "eleve/actions.ts",
    guards: /COOKIE_NAME/,
    mustContain: /is_active/,
  },
]

/**
 * Actions publiquement invocables, par conception :
 * chaque entrée doit être justifiée — une exception non listée fait échouer
 * le test, une exception obsolète doit être retirée.
 */
const PUBLIC_ACTIONS: ReadonlyArray<{ action: string; module: string; because: string }> = [
  {
    action: "createPreEnrollment",
    module: "dashboard/admissions/pre-enrollments.ts",
    because: "tunnel public /enroll/[schoolId] — le parent n'a pas de compte",
  },
  {
    action: "verifyReceipt",
    module: "dashboard/finance/receipts.ts",
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
          !PUBLIC_ACTIONS.some(
            (publicAction) =>
              publicAction.action === a.name && publicAction.module === module.file
          )
      )
      expect(unguarded.map((a) => a.name)).toEqual([])

      if (module.mustContain) {
        expect(module.mustContain.test(source)).toBe(true)
      }
    }
  )

  it("les exceptions publiques existent toujours dans leur module", () => {
    for (const entry of PUBLIC_ACTIONS) {
      const source = readFileSync(join(SRC, entry.module), "utf-8")
      expect(source).toContain(`export async function ${entry.action}`)
    }
  })

  it("la liste des exceptions publiques est justifiée (pas d'exception orpheline)", () => {
    for (const entry of PUBLIC_ACTIONS) {
      expect(entry.because).toMatch(/\S/)
    }
  })
})