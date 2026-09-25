import { describe, expect, it } from "vitest"
import {
  clientIpFromHeaders,
  createRateLimiter,
  RATE_LIMIT_POLICIES,
} from "./rate-limit"

/** Horloge manuelle : le temps n'avance que quand le test le décide. */
function fakeClock(start = 1_700_000_000_000) {
  let current = start
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    },
  }
}

const POLICY = { limit: 3, windowMs: 60_000 }

describe("createRateLimiter", () => {
  it("autorise jusqu'à la limite puis refuse", () => {
    const clock = fakeClock()
    const limiter = createRateLimiter(clock.now)

    expect(limiter.check("ip:1", POLICY)).toMatchObject({ ok: true, remaining: 2 })
    expect(limiter.check("ip:1", POLICY)).toMatchObject({ ok: true, remaining: 1 })
    expect(limiter.check("ip:1", POLICY)).toMatchObject({ ok: true, remaining: 0 })
    expect(limiter.check("ip:1", POLICY)).toMatchObject({
      ok: false,
      remaining: 0,
    })
  })

  it("renvoie le délai restant avant de réessayer", () => {
    const clock = fakeClock()
    const limiter = createRateLimiter(clock.now)

    limiter.check("ip:1", { limit: 1, windowMs: 60_000 })
    clock.advance(45_000)
    expect(limiter.check("ip:1", { limit: 1, windowMs: 60_000 })).toMatchObject({
      ok: false,
      retryAfterSeconds: 15,
    })
  })

  it("arrondit le délai à la seconde supérieure (jamais 0)", () => {
    const clock = fakeClock()
    const limiter = createRateLimiter(clock.now)

    limiter.check("ip:1", { limit: 1, windowMs: 1_000 })
    clock.advance(999)
    expect(limiter.check("ip:1", { limit: 1, windowMs: 1_000 })).toMatchObject({
      ok: false,
      retryAfterSeconds: 1,
    })
  })

  it("réinitialise le compteur quand la fenêtre est échue", () => {
    const clock = fakeClock()
    const limiter = createRateLimiter(clock.now)

    limiter.check("ip:1", POLICY)
    limiter.check("ip:1", POLICY)
    limiter.check("ip:1", POLICY)
    expect(limiter.check("ip:1", POLICY).ok).toBe(false)

    clock.advance(60_000)
    expect(limiter.check("ip:1", POLICY)).toMatchObject({ ok: true, remaining: 2 })
  })

  it("isole les clés entre elles", () => {
    const clock = fakeClock()
    const limiter = createRateLimiter(clock.now)

    limiter.check("ip:1", { limit: 1, windowMs: 60_000 })
    expect(limiter.check("ip:2", { limit: 1, windowMs: 60_000 }).ok).toBe(true)
    expect(limiter.check("ip:1", { limit: 1, windowMs: 60_000 }).ok).toBe(false)
  })

  it("borne la mémoire face aux clés jetables", () => {
    const clock = fakeClock()
    const limiter = createRateLimiter(clock.now)
    const policy = { limit: 1, windowMs: 60_000 }

    // Une clé sature sa fenêtre, puis 6 000 autres clés la pushing hors mémoire.
    limiter.check("cible", policy)
    for (let index = 0; index < 6_000; index += 1) {
      limiter.check(`bruit:${index}`, policy)
    }

    // Éjectée, la clé rejoue une fenêtre neuve au lieu d'être refusée
    // indéfiniment : le service reste utilisable, la mémoire reste bornée.
    expect(limiter.check("cible", policy).ok).toBe(true)
  })
})

describe("clientIpFromHeaders", () => {
  it("retient le premier élément de x-forwarded-for", () => {
    expect(
      clientIpFromHeaders((name) =>
        name === "x-forwarded-for" ? "203.0.113.7, 10.0.0.1, 10.0.0.2" : null
      )
    ).toBe("203.0.113.7")
  })

  it("retombe sur x-real-ip, puis sur null", () => {
    expect(clientIpFromHeaders((name) => (name === "x-real-ip" ? "198.51.100.4" : null))).toBe(
      "198.51.100.4"
    )
    expect(clientIpFromHeaders(() => null)).toBeNull()
    expect(clientIpFromHeaders(() => "   ")).toBeNull()
  })

  it("ignore une chaîne vide", () => {
    expect(clientIpFromHeaders((name) => (name === "x-forwarded-for" ? "  ,10.0.0.1" : null))).toBeNull()
  })
})

describe("RATE_LIMIT_POLICIES", () => {
  it("expose des politiques utilisables (jamais de limite nulle ou de fenêtre nulle)", () => {
    for (const [name, policy] of Object.entries(RATE_LIMIT_POLICIES)) {
      expect(policy.limit, name).toBeGreaterThanOrEqual(1)
      expect(policy.windowMs, name).toBeGreaterThanOrEqual(1_000)
    }
  })
})
