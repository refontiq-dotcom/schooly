import { afterEach, describe, expect, it, vi } from "vitest";
import { isTrouvetouRequest } from "./trouvetou-auth";

const providerKey = "tv_live_12345678-1234-1234-1234-123456789abc.test-secret";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isTrouvetouRequest", () => {
  it("accepts the provider key in x-trouvetou-api-key", () => {
    vi.stubEnv("TROUVETOU_API_KEY", providerKey);
    const request = new Request("https://schooly.example/api", {
      headers: { "x-trouvetou-api-key": providerKey },
    });
    expect(isTrouvetouRequest(request)).toBe(true);
  });

  it("accepts the provider key as a Bearer token for compatibility", () => {
    vi.stubEnv("TROUVETOU_API_KEY", providerKey);
    const request = new Request("https://schooly.example/api", {
      headers: { authorization: `Bearer ${providerKey}` },
    });
    expect(isTrouvetouRequest(request)).toBe(true);
  });

  it("never accepts the global HMAC pepper as an API key", () => {
    vi.stubEnv("TROUVETOU_API_KEY", providerKey);
    vi.stubEnv("TROUVETOU_API_KEY_PEPPER", "global-hmac-pepper");
    const request = new Request("https://schooly.example/api", {
      headers: { authorization: "Bearer global-hmac-pepper" },
    });
    expect(isTrouvetouRequest(request)).toBe(false);
  });

  it("rejects missing and incorrect provider keys", () => {
    vi.stubEnv("TROUVETOU_API_KEY", providerKey);
    expect(isTrouvetouRequest(new Request("https://schooly.example/api"))).toBe(false);
    expect(
      isTrouvetouRequest(
        new Request("https://schooly.example/api", {
          headers: { "x-trouvetou-api-key": "wrong-key" },
        }),
      ),
    ).toBe(false);
  });

  it("fails closed when the provider key is not configured", () => {
    vi.stubEnv("TROUVETOU_API_KEY", "");
    const request = new Request("https://schooly.example/api", {
      headers: { "x-trouvetou-api-key": providerKey },
    });
    expect(isTrouvetouRequest(request)).toBe(false);
  });
});
