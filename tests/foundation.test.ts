import { beforeEach, describe, expect, it } from "vitest";
import { TAB_ROUTES } from "@/navigation/tabs";
import {
  getDataLayerRuntime,
  readRepositoryState,
  writeRepositoryState
} from "@/data/localFirstRepository";
import {
  getCurrentTrip,
  getDashboardSnapshot,
  getLedgerEntries,
  getPackingLists,
  resetCurrentTripStoreForTests
} from "@/data/currentTripStore";
import { resetTripIdentityStoreForTests } from "@/data/tripIdentityStore";
import { getLocalDataScaffold } from "@/data/localDataScaffold";

describe("foundation contracts", () => {
  beforeEach(() => {
    resetTripIdentityStoreForTests();
    resetCurrentTripStoreForTests();
  });

  it("defines the three primary tabs", () => {
    expect(TAB_ROUTES.map((route) => route.name)).toEqual([
      "Dashboard",
      "Lists",
      "Ledger"
    ]);

    expect(TAB_ROUTES.map((route) => route.href)).toEqual([
      "/",
      "/lists",
      "/ledger"
    ]);
  });

  it("serves the local-first active trip before remote sync", () => {
    const trip = getCurrentTrip();

    expect(trip.id).toBe("trip-active-001");
    expect(trip.destination).toBe("Goa");
    expect(trip.currency).toBe("INR");
    expect(getDashboardSnapshot().tripId).toBe(trip.id);
    expect(getPackingLists().length).toBeGreaterThan(0);
    expect(getLedgerEntries().length).toBeGreaterThan(0);
  });

  it("exposes the local-first WatermelonDB and Supabase sync boundary", () => {
    const scaffold = getLocalDataScaffold();

    expect(scaffold.schemaVersion).toBe(2);
    expect(scaffold.entities).toEqual([
      "trips",
      "trip_members",
      "family_groups",
      "family_group_members",
      "trip_lists",
      "ledger_entries"
    ]);
    expect(scaffold.syncMode).toBe("prototype-local-store-sync-ready");
    expect(scaffold.notes.storageAdapter).toBe("repository-store-prototype");
    expect(scaffold.notes.syncProvider).toBe("supabase");
    expect(getDataLayerRuntime()).toMatchObject({
      localAdapter: "repository-store-prototype",
      remoteAdapter: "supabase",
      authProvider: "google-oauth-only",
      editLockTtlSeconds: 30
    });
  });

  it("persists repository namespaces behind the store layer", () => {
    writeRepositoryState("current-trip", { marker: "saved" });

    expect(readRepositoryState("current-trip", () => ({ marker: "seed" }))).toEqual({
      marker: "saved"
    });
    resetTripIdentityStoreForTests();
    resetCurrentTripStoreForTests();
  });
});
