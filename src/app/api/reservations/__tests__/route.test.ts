import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

import { POST } from "../route";

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/reservations — contrat HTTP", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 400 si champs obligatoires manquants", async () => {
    const req = buildRequest({ establishment_id: "x", level_id: "y" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si le body est invalide", async () => {
    const req = new Request("http://localhost/api/reservations", {
      method: "POST",
      body: "not json",
    }) as unknown as import("next/server").NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 201 + reservation quand create_reservation_smart réussit (place dispo)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        id: "res-1",
        establishment_id: "est-1",
        level_id: "lvl-1",
        section_id: "sec-1",
        student_full_name: "Aya Kouassi",
        status: "reserved",
        parent_trust_score: 75,
        fraud_flags: [],
        waitlist_position: null,
        expires_at: "2026-09-05T12:00:00Z",
        created_at: "2026-09-03T10:00:00Z",
      },
      error: null,
    });

    const req = buildRequest({
      establishment_id: "est-1",
      level_id: "lvl-1",
      student_full_name: "Aya Kouassi",
      parent_full_name: "Kouamé Yao",
      parent_phone: "+225 07 00 00 00 00",
      parent_email: "k@example.com",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.reservation.id).toBe("res-1");
    expect(json.reservation.status).toBe("reserved");
    expect(json.parent_trust_score).toBe(75);
    expect(json.fraud_flags).toEqual([]);
    expect(mockRpc).toHaveBeenCalledWith("create_reservation_smart", {
      p_establishment_id: "est-1",
      p_level_id: "lvl-1",
      p_student_full_name: "Aya Kouassi",
      p_student_birthdate: null,
      p_parent_full_name: "Kouamé Yao",
      p_parent_phone: "+225 07 00 00 00 00",
      p_parent_email: "k@example.com",
    });
  });

  it("retourne 201 + waitlist_position quand la réservation passe en file d'attente", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        id: "res-2",
        status: "waitlisted",
        section_id: null,
        waitlist_position: 3,
        parent_trust_score: 60,
        fraud_flags: [],
        student_full_name: "Test",
        establishment_id: "est-1",
        level_id: "lvl-1",
        created_at: "2026-09-03T10:00:00Z",
      },
      error: null,
    });

    const req = buildRequest({
      establishment_id: "est-1",
      level_id: "lvl-1",
      student_full_name: "Test",
      parent_full_name: "Test Parent",
      parent_phone: "+225 07 00 00 00 00",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.reservation.status).toBe("waitlisted");
    expect(json.waitlist_position).toBe(3);
  });

  it("retourne 403 + code FRAUD_REJECTED quand la fonction retourne rejected_fraud", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        id: "res-3",
        status: "rejected_fraud",
        fraud_flags: ["DUPLICATE_STUDENT", "RAPID_REPEAT"],
        parent_trust_score: 20,
        student_full_name: "Fraud",
        establishment_id: "est-1",
        level_id: "lvl-1",
        section_id: null,
        created_at: "2026-09-03T10:00:00Z",
      },
      error: null,
    });

    const req = buildRequest({
      establishment_id: "est-1",
      level_id: "lvl-1",
      student_full_name: "Fraud",
      parent_full_name: "Fraud Parent",
      parent_phone: "+225 07 00 00 00 00",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBe("FRAUD_REJECTED");
    expect(json.fraud_flags).toContain("DUPLICATE_STUDENT");
  });

  it("retourne 409 si la fonction renvoie une erreur Postgres", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Plus de place disponible pour ce niveau" },
    });

    const req = buildRequest({
      establishment_id: "est-1",
      level_id: "lvl-1",
      student_full_name: "X",
      parent_full_name: "Y",
      parent_phone: "+225 07",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/Plus de place/);
  });
});