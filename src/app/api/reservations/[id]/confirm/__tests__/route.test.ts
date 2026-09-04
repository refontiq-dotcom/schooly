import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockSelect = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockSingle = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...args: unknown[]) => {
            mockEq(...args);
            return {
              maybeSingle: mockMaybeSingle,
              single: mockSingle,
            };
          },
        };
      },
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return {
          eq: (...args: unknown[]) => {
            mockEq(...args);
            return Promise.resolve({ error: null });
          },
        };
      },
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

import { POST } from "../route";

function buildRequest(id: string, body: unknown = {}) {
  const params = Promise.resolve({ id });
  return {
    request: new Request(`http://localhost/api/reservations/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params,
  } as unknown as { request: import("next/server").NextRequest; params: Promise<{ id: string }> };
}

describe("POST /api/reservations/:id/confirm — idempotence", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockUpdate.mockReset();
    mockEq.mockReset();
    mockRpc.mockReset();
    mockMaybeSingle.mockReset();
    mockSingle.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 404 si la réservation n'existe pas", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { request, params } = buildRequest("res-1");
    const res = await POST(request, { params });
    expect(res.status).toBe(404);
  });

  it("retourne 409 si la réservation est expirée", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "res-1", status: "expired" },
      error: null,
    });

    const { request, params } = buildRequest("res-1");
    const res = await POST(request, { params });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("EXPIRED");
  });

  it("retourne 409 si la réservation est annulée", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "res-1", status: "cancelled" },
      error: null,
    });

    const { request, params } = buildRequest("res-1");
    const res = await POST(request, { params });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("CANCELLED");
  });

  it("est idempotent : pas de second appel à reserve_seat si déjà reserved", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "res-1", status: "reserved" },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: { id: "res-1", status: "reserved", payment_reference: "PREV-1" },
      error: null,
    });

    const { request, params } = buildRequest("res-1", { payment_reference: "PREV-1" });
    const res = await POST(request, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.already_reserved).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("appelle reserve_seat quand le statut est pending_payment", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "res-1", status: "pending_payment" },
      error: null,
    });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: "res-1", status: "reserved" },
      error: null,
    });

    const { request, params } = buildRequest("res-1", { payment_reference: "PAY-1", amount_paid: 5000 });
    const res = await POST(request, { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.already_reserved).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith("reserve_seat", { p_reservation_id: "res-1" });
  });

  it("retourne 409 si reserve_seat échoue", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "res-1", status: "pending_payment" },
      error: null,
    });
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Plus de place disponible dans cette section" },
    });

    const { request, params } = buildRequest("res-1");
    const res = await POST(request, { params });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("RESERVE_FAILED");
  });
});