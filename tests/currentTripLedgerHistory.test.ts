import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addManualCashLedgerEntry,
  confirmManualLedgerEntrySync,
  getCurrentTrip,
  getLedgerActivityHistory,
  getLedgerEntries,
  hardDeleteLedgerEntry,
  requestLedgerEntryEditLock,
  resetCurrentTripStoreForTests,
  softDeleteLedgerEntry
} from "@/data/currentTripStore";
import { getTripMembers } from "@/data/tripIdentityStore";

describe("current-trip ledger history contract", () => {
  beforeEach(() => {
    resetCurrentTripStoreForTests();
  });

  afterEach(() => {
    resetCurrentTripStoreForTests();
  });

  it("creates manual cash entries as pending, then marks them synced, and exposes activity history to all members", () => {
    const trip = getCurrentTrip();
    const members = getTripMembers(trip.id);
    const editorMemberId = members[0]?.id;
    const viewerMemberId = members[1]?.id;

    if (!editorMemberId || !viewerMemberId) {
      throw new Error("expected seeded members");
    }

    const manual = addManualCashLedgerEntry({
      label: "Street market snacks",
      amount: 17.4,
      paidBy: "Soham",
      actingTripMemberId: editorMemberId
    });

    expect(manual.syncStatus).toBe("pending");
    expect(manual.isCash).toBe(true);

    const synced = confirmManualLedgerEntrySync({
      ledgerEntryId: manual.id,
      actingTripMemberId: editorMemberId
    });

    expect(synced.syncStatus).toBe("synced");

    const memberOneView = getLedgerActivityHistory({ actingTripMemberId: editorMemberId });
    const memberTwoView = getLedgerActivityHistory({ actingTripMemberId: viewerMemberId });

    expect(memberOneView.length).toBeGreaterThanOrEqual(2);
    expect(memberTwoView.map((activity) => activity.id)).toEqual(
      memberOneView.map((activity) => activity.id)
    );

    expect(getLedgerEntries().some((entry) => entry.id === manual.id)).toBe(true);
  });

  it("returns a conflict prompt while a lock is active and grants the lock after 30-second expiry", () => {
    const trip = getCurrentTrip();
    const members = getTripMembers(trip.id);
    const firstMemberId = members[0]?.id;
    const secondMemberId = members[1]?.id;
    const targetEntryId = getLedgerEntries()[0]?.id;

    if (!firstMemberId || !secondMemberId || !targetEntryId) {
      throw new Error("expected seeded ledger and members");
    }

    const granted = requestLedgerEntryEditLock({
      ledgerEntryId: targetEntryId,
      actingTripMemberId: firstMemberId,
      nowIso: "2026-05-03T12:00:00Z"
    });

    expect(granted.status).toBe("granted");

    const conflict = requestLedgerEntryEditLock({
      ledgerEntryId: targetEntryId,
      actingTripMemberId: secondMemberId,
      nowIso: "2026-05-03T12:00:10Z"
    });

    expect(conflict.status).toBe("conflict");
    if (conflict.status === "conflict") {
      expect(conflict.prompt).toMatch(/already editing/i);
      expect(conflict.expiresAt).toBe("2026-05-03T12:00:30.000Z");
    }

    const afterExpiry = requestLedgerEntryEditLock({
      ledgerEntryId: targetEntryId,
      actingTripMemberId: secondMemberId,
      nowIso: "2026-05-03T12:00:31Z"
    });

    expect(afterExpiry.status).toBe("granted");
  });

  it("soft-deletes by default and allows hard delete only for the primary admin member", () => {
    const trip = getCurrentTrip();
    const members = getTripMembers(trip.id);
    const primaryAdminMemberId = members[0]?.id;
    const nonAdminMemberId = members[1]?.id;

    if (!primaryAdminMemberId || !nonAdminMemberId) {
      throw new Error("expected seeded members");
    }

    const manual = addManualCashLedgerEntry({
      label: "Museum tickets",
      amount: 34,
      paidBy: "Ava",
      actingTripMemberId: nonAdminMemberId
    });

    const softDeleted = softDeleteLedgerEntry({
      ledgerEntryId: manual.id,
      actingTripMemberId: nonAdminMemberId
    });

    expect(softDeleted.deletedAt).toBeDefined();
    expect(getLedgerEntries().some((entry) => entry.id === manual.id)).toBe(true);

    expect(() =>
      hardDeleteLedgerEntry({
        ledgerEntryId: manual.id,
        actingTripMemberId: nonAdminMemberId
      })
    ).toThrow(/primary admin/i);

    hardDeleteLedgerEntry({
      ledgerEntryId: manual.id,
      actingTripMemberId: primaryAdminMemberId
    });

    expect(getLedgerEntries().some((entry) => entry.id === manual.id)).toBe(false);
  });
});
