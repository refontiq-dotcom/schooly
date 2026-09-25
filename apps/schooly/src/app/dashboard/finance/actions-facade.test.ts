import { describe, expect, it } from "vitest"
import * as financeActions from "./actions"

const FINANCE_ACTION_EXPORTS = [
  "applySiblingDiscounts",
  "cancelPayment",
  "closeCashSession",
  "createFeeSchedule",
  "createManualDiscount",
  "createPayment",
  "deleteDiscount",
  "deleteFeeSchedule",
  "duplicateFeeSchedule",
  "generateAccountingExport",
  "generateDueReminders",
  "generateMissingFeeItems",
  "getAccountingExports",
  "getCashSessions",
  "getEnrollmentDiscounts",
  "getFeeSchedules",
  "getFinanceConfig",
  "getFinanceOverview",
  "getOpenCashSession",
  "getPayments",
  "getStudentBalances",
  "openCashSession",
  "verifyReceipt",
]

describe("façade finance", () => {
  it("conserve tous les exports Server Action historiques", () => {
    expect(Object.keys(financeActions).sort()).toEqual([...FINANCE_ACTION_EXPORTS].sort())
  })
})
