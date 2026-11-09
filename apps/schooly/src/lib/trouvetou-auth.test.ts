import { afterEach, describe, expect, it, vi } from "vitest";
import { isTrouvetouRequest } from "./trouvetou-auth";

const providerKey = "tv_live_12345678-1234-1234-1234-123456789abc.test-secret";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isTrouvetouRequest", () => {
  it("accepts the provider key in x-trouvetou-booking-secret", () => {
    vi.stubEnv("TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET", providerKey);
    const request = new Request("https://schooly.example/api", {
      headers: { "x-trouvetou-booking-secret": providerKey },
    });
    expect(isTrouvetouRequest(request)).toBe(true);
  });

  it("rejects Bearer tokens for booking routes", () => {
    vi.stubEnv("TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET", providerKey);
    const request = new Request("https://schooly.example/api", {
      headers: { authorization: `Bearer ${providerKey}` },
    });
    expect(isTrouvetouRequest(request)).toBe(false);
  });

  it("never accepts the global HMAC pepper as an API key", () => {
    vi.stubEnv("TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET", providerKey);
    vi.stubEnv("TROUVETOU_API_KEY_PEPPER", "global-hmac-pepper");
    const request = new Request("https://schooly.example/api", {
      headers: { "x-trouvetou-booking-secret": "global-hmac-pepper" },
    });
    expect(isTrouvetouRequest(request)).toBe(false);
  });

  it("rejects missing and incorrect provider keys", () => {
    vi.stubEnv("TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET", providerKey);
    expect(isTrouvetouRequest(new Request("https://schooly.example/api"))).toBe(false);
    expect(
      isTrouvetouRequest(
        new Request("https://schooly.example/api", {
          headers: { "x-trouvetou-booking-secret": "wrong-key" },
        }),
      ),
    ).toBe(false);
  });

  it("fails closed when the provider key is not configured", () => {
    vi.stubEnv("TROUVETOU_SCHOOLY_BOOKING_SHARED_SECRET", "");
    const request = new Request("https://schooly.example/api", {
      headers: { "x-trouvetou-booking-secret": providerKey },
    });
    expect(isTrouvetouRequest(request)).toBe(false);
  });
});
