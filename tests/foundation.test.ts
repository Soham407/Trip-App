import { describe, expect, it } from "vitest";
import { TAB_ROUTES } from "@/navigation/tabs";
import {
  getCurrentTrip,
  getDashboardSnapshot,
  getLedgerEntries,
  getPackingLists
} from "@/data/currentTripStore";
import { getLocalDataScaffold } from "@/data/localDataScaffold";

describe("foundation contracts", () => {
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

  it("serves mocked active-trip data with no backend", () => {
    const trip = getCurrentTrip();

    expect(trip.id).toBe("trip-active-001");
    expect(trip.destination).toBe("Lisbon");
    expect(getDashboardSnapshot().tripId).toBe(trip.id);
    expect(getPackingLists().length).toBeGreaterThan(0);
    expect(getLedgerEntries().length).toBeGreaterThan(0);
  });

  it("exposes a local data scaffold for future WatermelonDB and sync work", () => {
    const scaffold = getLocalDataScaffold();

    expect(scaffold.schemaVersion).toBe(1);
    expect(scaffold.entities).toEqual(["trips", "packing_lists", "ledger_entries"]);
    expect(scaffold.syncMode).toBe("local-only");
  });
});
