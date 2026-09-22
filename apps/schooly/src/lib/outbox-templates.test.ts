import { describe, expect, it } from "vitest"
import {
  normalizeCiPhone,
  renderOutboxMessage,
  retryDelayMs,
} from "./outbox-templates"

describe("renderOutboxMessage", () => {
  const payload = {
    student: "Awa Diallo",
    due_date: "2026-09-27",
    amount: 25000,
    balance: 25000,
  }

  it("rend les 4 paliers J-5 / J0 / J+1 / J+7", () => {
    expect(renderOutboxMessage("fee_reminder_j5", payload)).toContain("Awa Diallo")
    expect(renderOutboxMessage("fee_reminder_j5", payload)).toContain("5 jours")
    expect(renderOutboxMessage("fee_reminder_j0", payload)).toContain("aujourd'hui")
    expect(renderOutboxMessage("fee_reminder_j1", payload)).toMatch(/25\s000/)
    expect(renderOutboxMessage("fee_reminder_j7", payload)).toContain("7 jours")
  })

  it("formate la date ISO en JJ/MM/AAAA", () => {
    expect(renderOutboxMessage("fee_reminder_j0", payload)).toContain("27/09/2026")
  })

  it("rend les rappels moratoires via le fallback reminder_*", () => {
    const msg = renderOutboxMessage("reminder_moratorium", {
      student: "Awa Diallo",
      reminder_type: "moratorium",
    })
    expect(msg).toContain("moratorium")
  })

  it("retourne null sur template inconnu (→ failed sans retry)", () => {
    expect(renderOutboxMessage("nope_unknown", payload)).toBeNull()
  })
})

describe("normalizeCiPhone", () => {
  it("normalise les formats locaux vers 225…", () => {
    expect(normalizeCiPhone("07 00 00 00 00")).toBe("2250700000000")
    expect(normalizeCiPhone("0700000000")).toBe("2250700000000")
    expect(normalizeCiPhone("+2250700000000")).toBe("2250700000000")
    expect(normalizeCiPhone("002250700000000")).toBe("2250700000000")
  })

  it("rejette les numéros inexploitables", () => {
    expect(normalizeCiPhone("")).toBeNull()
    expect(normalizeCiPhone("abc")).toBeNull()
    expect(normalizeCiPhone(null)).toBeNull()
    expect(normalizeCiPhone("123")).toBeNull()
  })
})

describe("retryDelayMs", () => {
  it("applique un backoff 5min · 2^n plafonné à 24h", () => {
    expect(retryDelayMs(0)).toBe(5 * 60 * 1000)
    expect(retryDelayMs(1)).toBe(10 * 60 * 1000)
    expect(retryDelayMs(2)).toBe(20 * 60 * 1000)
    expect(retryDelayMs(99)).toBe(24 * 60 * 60 * 1000)
  })
})
