export type DirectoryHaystack = {
  texts: Array<string | null | undefined>
  phones?: Array<string | null | undefined>
  codes?: Array<string | null | undefined>
}

export function foldText(value: string | null | undefined): string {
  if (!value) return ""
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function digitsOnly(value: string | null | undefined): string {
  if (!value) return ""
  return String(value).replace(/\D/g, "")
}

export function stripPhoneCountry(digits: string): string {
  if (digits.startsWith("00225")) return digits.slice(5)
  if (digits.startsWith("225") && digits.length > 10) return digits.slice(3)
  return digits
}

export function isPhoneLike(query: string): boolean {
  const digits = digitsOnly(query)
  if (digits.length < 4) return false
  const compact = query.trim().replace(/[\s./-]/g, "")
  const rest = compact.startsWith("+")
    ? compact.slice(1)
    : compact.startsWith("00")
      ? compact.slice(2)
      : compact
  return /^\d+$/.test(rest)
}

export function tokenize(query: string): string[] {
  return foldText(query)
    .split(/[^a-z0-9+]+/)
    .filter((token) => token.length > 0)
}

export function parseQuery(raw: string): { tokens: string[]; phone: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) return { tokens: [], phone: null }

  if (isPhoneLike(trimmed)) {
    return { tokens: [], phone: stripPhoneCountry(digitsOnly(trimmed)) }
  }

  const tokens = tokenize(trimmed).filter((token) => token.length >= 2 || /^\d/.test(token))
  return { tokens, phone: null }
}

export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  if (a.length > b.length) return withinOneEdit(b, a)

  let i = 0
  let j = 0
  let edits = 0
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (a.length === b.length) {
      i += 1
      j += 1
    } else {
      j += 1
    }
  }
  return i >= a.length
}

function tokenScore(token: string, fields: string[]): number {
  let best = 0
  for (const field of fields) {
    if (!field) continue
    if (field === token) {
      best = Math.max(best, 100)
      continue
    }
    if (field.startsWith(token)) {
      best = Math.max(best, 82)
    }
    const words = field.split(/[^a-z0-9]+/).filter(Boolean)
    for (const word of words) {
      if (word === token) best = Math.max(best, 94)
      else if (word.startsWith(token)) best = Math.max(best, 76)
      else if (token.length >= 3 && word.includes(token)) best = Math.max(best, 48)
      else if (token.length >= 4 && word.length >= 4 && withinOneEdit(token, word)) {
        best = Math.max(best, 32)
      }
    }
    if (token.length >= 2 && field.includes(token)) {
      best = Math.max(best, 40)
    }
  }
  return best
}

function phoneScore(queryDigits: string, phones: string[]): number {
  for (const phone of phones) {
    if (!phone) continue
    if (phone === queryDigits) return 100
    if (phone.includes(queryDigits) || queryDigits.includes(phone)) return 88
    const tail = phone.slice(-8)
    const qTail = queryDigits.slice(-8)
    if (tail.length === 8 && tail === qTail) return 92
  }
  return 0
}

export function rankDirectory<T>(
  items: T[],
  query: string,
  getHaystack: (item: T) => DirectoryHaystack,
): T[] {
  const parsed = parseQuery(query)
  if (!parsed.tokens.length && !parsed.phone) return items

  const scored: { item: T; score: number }[] = []

  for (const item of items) {
    const hay = getHaystack(item)
    const codes = (hay.codes ?? []).map(foldText).filter(Boolean)
    const phones = (hay.phones ?? [])
      .map((phone) => stripPhoneCountry(digitsOnly(phone)))
      .filter((phone) => phone.length >= 4)
    const texts = [...hay.texts.map(foldText), ...codes, ...phones].filter(Boolean)

    let score = 0

    if (parsed.phone) {
      const hit = phoneScore(parsed.phone, phones)
      if (parsed.tokens.length === 0) {
        if (hit <= 0) continue
        score += hit
      } else if (hit > 0) {
        score += hit * 0.4
      }
    }

    let missed = false
    for (const token of parsed.tokens) {
      const textHit = tokenScore(token, texts)
      const codeHit = tokenScore(token, codes)
      const best = Math.max(textHit, codeHit)
      if (best <= 0) {
        missed = true
        break
      }
      score += best
    }
    if (missed) continue

    scored.push({ item, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((entry) => entry.item)
}

export function initialOf(name: string | null | undefined): string {
  const folded = foldText(name)
  const ch = folded.charAt(0)
  return ch >= "a" && ch <= "z" ? ch.toUpperCase() : "#"
}

export function groupByInitial<T>(
  items: T[],
  nameOf: (item: T) => string,
): { letter: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const letter = initialOf(nameOf(item))
    const list = map.get(letter)
    if (list) list.push(item)
    else map.set(letter, [item])
  }

  return [...map.keys()]
    .sort((a, b) => {
      if (a === "#") return 1
      if (b === "#") return -1
      return a.localeCompare(b, "fr")
    })
    .map((letter) => ({ letter, items: map.get(letter) ?? [] }))
}
