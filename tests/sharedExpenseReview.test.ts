import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  categorizeImportedExpense,
  getCurrentTrip,
  getDashboardSnapshot,
  getFailedExpenseIngestionLog,
  getLedgerEntries,
  getNeedsReviewExpenses,
  ingestSharedExpenseAlert,
  resetCurrentTripStoreForTests,
  subscribeCurrentTripStore,
  uncategorizeImportedExpense
} from "@/data/currentTripStore";
import { getTripMembers } from "@/data/tripIdentityStore";

describe("shared expense review and failed-log flow", () => {
  beforeEach(() => {
    resetCurrentTripStoreForTests();
  });

  afterEach(() => {
    resetCurrentTripStoreForTests();
  });

  it("ingests bank and FASTag alerts into uncategorized review expenses and logs parser failures", () => {
    const trip = getCurrentTrip();

    const bankExpense = ingestSharedExpenseAlert({
      source: "email",
      payload:
        "HDFC Bank Alert: Card XX19 used at LUSITANIA CAFE on 2026-05-03 09:12 for INR 845.20"
    });

    const fastagExpense = ingestSharedExpenseAlert({
      source: "webhook",
      payload:
        "FASTag Debit: Toll Plaza Kharghar charged INR 145.00 at 2026-05-03T11:06:00Z"
    });

    const failedExpense = ingestSharedExpenseAlert({
      source: "webhook",
      payload: "Webhook ping without money amount"
    });

    if (!bankExpense || !fastagExpense) {
      throw new Error("expected valid bank and FASTag payloads to ingest");
    }

    expect(bankExpense.status).toBe("imported-uncategorized");
    expect(fastagExpense.status).toBe("imported-uncategorized");
    expect(failedExpense).toBeNull();

    const reviewQueue = getNeedsReviewExpenses();
    expect(reviewQueue.length).toBe(2);
    expect(reviewQueue.every((expense) => expense.tripId === trip.id)).toBe(true);
    expect(reviewQueue.every((expense) => expense.status === "imported-uncategorized")).toBe(true);

    const failedLog = getFailedExpenseIngestionLog();
    expect(failedLog.length).toBe(1);
    expect(failedLog[0]?.rawPayload).toContain("Webhook ping");
    expect(failedLog[0]?.reason.length).toBeGreaterThan(0);

    const tripMembers = getTripMembers(trip.id);
    const actingMemberId = tripMembers[0]?.id;

    if (!actingMemberId) {
      throw new Error("expected seeded trip members");
    }

    const categorized = categorizeImportedExpense({
      expenseId: bankExpense.id,
      actingTripMemberId: actingMemberId,
      categoryParentId: "meals",
      categorySubcategoryId: "dining"
    });

    expect(categorized.status).toBe("categorized");
    expect(
      getLedgerEntries().some(
        (entry) =>
          entry.id === bankExpense.id &&
          entry.categoryParentId === "meals" &&
          entry.categorySubcategoryId === "dining"
      )
    ).toBe(true);
    expect(getNeedsReviewExpenses().map((expense) => expense.id)).toEqual([fastagExpense.id]);

    const uncategorizedAgain = uncategorizeImportedExpense({
      expenseId: bankExpense.id,
      actingTripMemberId: actingMemberId
    });

    expect(uncategorizedAgain.status).toBe("imported-uncategorized");
    expect(getNeedsReviewExpenses().map((expense) => expense.id)).toEqual([
      fastagExpense.id,
      bankExpense.id
    ]);

    expect(getDashboardSnapshot().needsReviewCount).toBe(2);

    expect(() =>
      categorizeImportedExpense({
        expenseId: fastagExpense.id,
        actingTripMemberId: "trip-member-outsider",
        categoryParentId: "transport",
        categorySubcategoryId: "transit"
      })
    ).toThrow(/trip member/i);
  });

  it("notifies shared subscribers when review queue changes", () => {
    let notifications = 0;
    const unsubscribe = subscribeCurrentTripStore(() => {
      notifications += 1;
    });

    const tripMemberId = getTripMembers(getCurrentTrip().id)[0]?.id;

    if (!tripMemberId) {
      throw new Error("expected seeded trip member");
    }

    const importedExpense = ingestSharedExpenseAlert({
      source: "email",
      payload:
        "HDFC Bank Alert: Card XX19 used at LUSITANIA CAFE on 2026-05-03 09:12 for INR 845.20"
    });

    if (!importedExpense) {
      throw new Error("expected expense from valid payload");
    }

    categorizeImportedExpense({
      expenseId: importedExpense.id,
      actingTripMemberId: tripMemberId,
      categoryParentId: "meals",
      categorySubcategoryId: "dining"
    });

    uncategorizeImportedExpense({
      expenseId: importedExpense.id,
      actingTripMemberId: tripMemberId
    });

    unsubscribe();

    expect(notifications).toBe(3);
    expect(getNeedsReviewExpenses().map((expense) => expense.id)).toContain(importedExpense.id);
  });
});
