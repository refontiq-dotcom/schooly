// Façade de compatibilité : les imports historiques restent stables.
// Les implémentations vivent désormais dans des modules serveur cohérents.
export {
  getFeeSchedules,
  createFeeSchedule,
  getFinanceConfig,
  duplicateFeeSchedule,
  deleteFeeSchedule,
} from "./fee-schedules"
export { getPayments, createPayment, cancelPayment } from "./payments"
export { getOpenCashSession, getCashSessions, openCashSession, closeCashSession } from "./cash"
export { verifyReceipt } from "./receipts"
export { getAccountingExports, generateAccountingExport } from "./accounting"
export { getStudentBalances, getFinanceOverview, generateMissingFeeItems } from "./balances"
export type { StudentBalance } from "./balances"
export {
  getEnrollmentDiscounts,
  createManualDiscount,
  deleteDiscount,
  applySiblingDiscounts,
} from "./discounts"
export { generateDueReminders } from "./reminders"
