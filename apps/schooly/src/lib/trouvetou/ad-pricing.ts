export const TROUVETOU_AD_PRICING = [
  { minDays: 1, maxDays: 6, dailyRate: 1000 },
  { minDays: 7, maxDays: 13, dailyRate: 900 },
  { minDays: 14, maxDays: 29, dailyRate: 800 },
  { minDays: 30, maxDays: null, dailyRate: 700 },
] as const

export function getTrouvetouAdDailyRate(days: number) {
  if (!Number.isInteger(days) || days < 1) return null
  return TROUVETOU_AD_PRICING.find((tier) => days >= tier.minDays && (tier.maxDays === null || days <= tier.maxDays))?.dailyRate ?? null
}

export function getInclusiveDays(startDate: string, endDate: string) {
  const start = new Date(startDate + "T00:00:00Z")
  const end = new Date(endDate + "T00:00:00Z")
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
}
