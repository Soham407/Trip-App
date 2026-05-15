import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addManualCashLedgerEntry,
  confirmManualLedgerEntrySync,
  getCurrentTrip,
  getLedgerActivityHistory,
  getLedgerEntries,
  hardDeleteLedgerEntry,
  hydrateCurrentTripStoreFromRemote,
  requestLedgerEntryEditLock,
  resetCurrentTripStoreForTests,
  softDeleteLedgerEntry,
  updateManualCashLedgerEntry
} from "@/data/currentTripStore";
import { getTripMembers, resetTripIdentityStoreForTests } from "@/data/tripIdentityStore";

describe("current-trip ledger history contract", () => {
  beforeEach(() => {
    resetTripIdentityStoreForTests();
    resetCurrentTripStoreForTests();
  });

  afterEach(() => {
    resetTripIdentityStoreForTests();
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

  it("hydrates remote edit locks so another device can block local edits", () => {
    const trip = getCurrentTrip();
    const members = getTripMembers(trip.id);
    const secondMemberId = members[1]?.id;
    const targetEntryId = getLedgerEntries()[0]?.id;

    if (!secondMemberId || !targetEntryId) {
      throw new Error("expected seeded ledger and members");
    }

    hydrateCurrentTripStoreFromRemote({
      lists: [],
      ledgerEntries: getLedgerEntries(),
      failedLogs: [],
      ledgerEditLocks: [
        {
          id: "remote-lock-1",
          tripId: trip.id,
          ledgerEntryId: targetEntryId,
          actingTripMemberId: secondMemberId,
          acquiredAt: "2026-05-03T12:00:00Z",
          expiresAt: "2099-05-03T12:00:30Z"
        }
      ]
    });

    const conflict = requestLedgerEntryEditLock({
      ledgerEntryId: targetEntryId,
      actingTripMemberId: members[0]?.id ?? "",
      nowIso: "2026-05-03T12:00:10Z"
    });

    expect(conflict.status).toBe("conflict");
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

  it("keeps a hard-deleted entry hidden across remote hydration until cloud delete lands", () => {
    const trip = getCurrentTrip();
    const members = getTripMembers(trip.id);
    const primaryAdminMemberId = members[0]?.id;

    if (!primaryAdminMemberId) {
      throw new Error("expected seeded members");
    }

    const manual = addManualCashLedgerEntry({
      label: "Temple tickets",
      amount: 20,
      paidBy: "Soham",
      actingTripMemberId: primaryAdminMemberId
    });

    hardDeleteLedgerEntry({
      ledgerEntryId: manual.id,
      actingTripMemberId: primaryAdminMemberId
    });

    hydrateCurrentTripStoreFromRemote({
      lists: [],
      ledgerEntries: [manual],
      failedLogs: []
    });

    expect(getLedgerEntries().some((entry) => entry.id === manual.id)).toBe(false);
  });

  it("edits an existing manual cash entry and marks it pending sync again", () => {
    const trip = getCurrentTrip();
    const editorMemberId = getTripMembers(trip.id)[0]?.id;

    if (!editorMemberId) {
      throw new Error("expected seeded member");
    }

    const manual = addManualCashLedgerEntry({
      label: "Cafe stop",
      amount: 12,
      paidBy: "Soham",
      actingTripMemberId: editorMemberId
    });

    const updated = updateManualCashLedgerEntry({
      ledgerEntryId: manual.id,
      label: "Cafe and snacks",
      amount: 18.5,
      paidBy: "Ava",
      actingTripMemberId: editorMemberId
    });

    expect(updated.label).toBe("Cafe and snacks");
    expect(updated.amount).toBe(18.5);
    expect(updated.paidBy).toBe("Ava");
    expect(updated.syncStatus).toBe("pending");
  });
});
