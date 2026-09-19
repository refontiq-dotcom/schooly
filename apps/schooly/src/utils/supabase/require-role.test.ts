import { describe, expect, it } from "vitest"
import {
  ERROR_BY_REASON,
  denial,
  requireSchoolRole,
  type DeniedReason,
} from "./require-role"

/**
 * Tests du socle d'autorisation (audit Finance, findings P1-2 + P1-3).
 *
 * Scénarios couverts :
 * 1. Sans session → UNAUTHENTICATED (pas d'écriture, pas de lecture).
 * 2. Session sans rattachement actif → NO_SCHOOL.
 * 3. Rôle hors liste → FORBIDDEN_ROLE (ex. professeur sur createFeeSchedule).
 * 4. school_id demandé ≠ école de session → CROSS_TENANT (IDOR constaté sur
 *    getPayments(schoolId), getFeeSchedules(schoolId), etc. — le paramètre
 *    client était utilisé tel quel avec la clé service_role).
 * 5. Cas nominaux : membre actif, rôle autorisé, lecture sur sa propre école.
 */

// ─── Doublure du client Supabase « session » ─────────────────────────────────
// Reproduit uniquement la chaîne réellement appelée :
//   auth.getUser() → from().select().eq().eq().limit().maybeSingle()

type RoleRow = { school_id: string; role_code: string } | null

function fakeClient(opts: { userId?: string | null; role?: RoleRow }) {
  const userId = opts.userId === undefined ? "user-1" : opts.userId
  const role = opts.role === undefined ? { school_id: "school-A", role_code: "direction" } : opts.role
  return {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({ maybeSingle: async () => ({ data: role }) }),
          }),
        }),
      }),
    }),
  }
}

const asClient = (c: ReturnType<typeof fakeClient>) =>
  c as unknown as Parameters<typeof requireSchoolRole>[0]

describe("requireSchoolRole — refus", () => {
  it("refuse sans session (UNAUTHENTICATED)", async () => {
    const out = await requireSchoolRole(asClient(fakeClient({ userId: null })))
    expect(out).toEqual({ ok: false, reason: "UNAUTHENTICATED" })
  })

  it("refuse un authentifié sans rattachement actif (NO_SCHOOL)", async () => {
    const out = await requireSchoolRole(asClient(fakeClient({ role: null })))
    expect(out).toEqual({ ok: false, reason: "NO_SCHOOL" })
  })

  it.each([
    ["professeur", "createFeeSchedule"],
    ["surveillance", "createFeeSchedule"],
    ["caisse", "createFeeSchedule"],
    ["secretariat", "createFeeSchedule"],
    ["parent", "createFeeSchedule"],
    ["eleve", "createFeeSchedule"],
  ])("refuse le rôle %s sur écriture direction/compta (FORBIDDEN_ROLE, cas %s)", async (roleCode) => {
    const out = await requireSchoolRole(
      asClient(fakeClient({ role: { school_id: "school-A", role_code: roleCode } })),
      { allowedRoles: ["direction", "compta"] }
    )
    expect(out).toEqual({ ok: false, reason: "FORBIDDEN_ROLE" })
  })

  it("ferme l'IDOR cross-tenant : school_id demandé ≠ école de session", async () => {
    // Cas réel constaté : getPayments("school-B") appelé par un membre de
    // school-A lisait les paiements de school-B (service_role, sans contrôle).
    const out = await requireSchoolRole(
      asClient(fakeClient({ role: { school_id: "school-A", role_code: "direction" } })),
      { requestedSchoolId: "school-B" }
    )
    expect(out).toEqual({ ok: false, reason: "CROSS_TENANT" })
  })
})

describe("requireSchoolRole — acceptations", () => {
  it("accepte un membre actif quand aucun rôle n'est exigé", async () => {
    const out = await requireSchoolRole(
      asClient(fakeClient({ role: { school_id: "school-A", role_code: "professeur" } }))
    )
    expect(out).toEqual({
      ok: true,
      context: { userId: "user-1", schoolId: "school-A", roleCode: "professeur" },
    })
  })

  it.each(["direction", "compta"])(
    "accepte le rôle %s sur écriture direction/compta",
    async (roleCode) => {
      const out = await requireSchoolRole(
        asClient(fakeClient({ role: { school_id: "school-A", role_code: roleCode } })),
        { allowedRoles: ["direction", "compta", "super_admin"] }
      )
      expect(out.ok).toBe(true)
    }
  )

  it("accepte la lecture quand le school_id demandé = école de session", async () => {
    const out = await requireSchoolRole(
      asClient(fakeClient({ role: { school_id: "school-A", role_code: "caisse" } })),
      { requestedSchoolId: "school-A" }
    )
    expect(out.ok).toBe(true)
  })

  it("tolère l'absence de school_id demandé (écritures)", async () => {
    const out = await requireSchoolRole(
      asClient(fakeClient({ role: { school_id: "school-A", role_code: "caisse" } })),
      { requestedSchoolId: undefined }
    )
    expect(out.ok).toBe(true)
  })
})

describe("denial — contrat d'erreur", () => {
  it.each([
    ["UNAUTHENTICATED", "Non autorisé"],
    ["NO_SCHOOL", "Aucune école rattachée"],
    ["FORBIDDEN_ROLE", "Action réservée à un rôle supérieur."],
    ["CROSS_TENANT", "Accès non autorisé."],
  ] as DeniedReason extends never ? never : [DeniedReason, string][])(
    "mappe %s vers le message existant %s (pas de fuite d'info)",
    (reason, message) => {
      expect(ERROR_BY_REASON[reason]).toBe(message)
      expect(denial(reason, [])).toEqual({ error: message, data: [] })
    }
  )

  it("conserve la forme { error, data } des lectures", () => {
    expect(denial("CROSS_TENANT", [])).toEqual({
      error: "Accès non autorisé.",
      data: [],
    })
  })
})
