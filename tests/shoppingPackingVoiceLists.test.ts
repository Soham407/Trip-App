import { beforeEach, describe, expect, it } from "vitest";

import { createTripFromCurrentMembers, getTripMembers, resetTripIdentityStoreForTests } from "@/data/tripIdentityStore";
import {
  NO_NETWORK_VOICE_DICTATION_MESSAGE,
  buildVoiceDictationReview,
  commitVoiceDictationReview,
  deleteTripListItem,
  getCurrentTrip,
  getLedgerActivityHistory,
  hydrateCurrentTripStoreFromRemote,
  getListSuggestions,
  getShoppingLists,
  getTripListsByKind,
  removeVoiceDictationReviewItem,
  resetCurrentTripStoreForTests,
  toggleTripListItem
} from "@/data/currentTripStore";

describe("shopping and packing lists with voice dictation", () => {
  beforeEach(() => {
    resetTripIdentityStoreForTests();
    resetCurrentTripStoreForTests();
  });

  it("keeps shopping and packing separate for the current trip", () => {
    const shoppingLists = getTripListsByKind("shopping");
    const packingLists = getTripListsByKind("packing");

    expect(shoppingLists.length).toBeGreaterThan(0);
    expect(packingLists.length).toBeGreaterThan(0);
    expect(getShoppingLists().every((list) => list.kind === "shopping")).toBe(true);
    expect(packingLists.every((list) => list.kind === "packing")).toBe(true);
  });

  it("blocks mic dictation while offline with the grill-session message", () => {
    const blocked = buildVoiceDictationReview({
      kind: "shopping",
      utterance: "milk, bread",
      isOnline: false
    });

    expect(blocked.status).toBe("blocked");
    if (blocked.status !== "blocked") {
      throw new Error("expected blocked dictation");
    }

    expect(blocked.message).toBe(NO_NETWORK_VOICE_DICTATION_MESSAGE);
  });

  it("supports multi-item dictation, review removals, and all-at-once commit", () => {
    const ready = buildVoiceDictationReview({
      kind: "shopping",
      utterance: "milk, eggs and bananas",
      isOnline: true
    });

    expect(ready.status).toBe("ready");
    if (ready.status !== "ready") {
      throw new Error("expected ready dictation review");
    }

    expect(ready.review.candidates.map((item) => item.label)).toEqual([
      "milk",
      "eggs",
      "bananas"
    ]);

    const trimmedReview = removeVoiceDictationReviewItem({
      review: ready.review,
      candidateId: ready.review.candidates[1]?.id ?? ""
    });

    expect(trimmedReview.candidates.map((item) => item.label)).toEqual(["milk", "bananas"]);

    const beforeCount = getTripListsByKind("shopping")[0]?.items.length ?? 0;
    const commitResult = commitVoiceDictationReview(trimmedReview);
    const afterCount = getTripListsByKind("shopping")[0]?.items.length ?? 0;

    expect(commitResult.addedCount).toBe(2);
    expect(afterCount - beforeCount).toBe(2);

    const actingTripMemberId = getTripMembers(getCurrentTrip().id)[0]?.id;

    if (!actingTripMemberId) {
      throw new Error("expected seeded trip member");
    }

    expect(
      getLedgerActivityHistory({ actingTripMemberId }).some((activity) =>
        activity.message.includes('Added shopping item "milk"')
      )
    ).toBe(true);
  });

  it("toggles shopping and packing checklist items", () => {
    const shoppingItem = getTripListsByKind("shopping")[0]?.items[0];

    if (!shoppingItem) {
      throw new Error("expected seeded shopping item");
    }

    const toggled = toggleTripListItem({ kind: "shopping", itemId: shoppingItem.id });
    const refreshedItem = getTripListsByKind("shopping")[0]?.items.find(
      (item) => item.id === shoppingItem.id
    );

    expect(toggled.checked).toBe(!shoppingItem.checked);
    expect(refreshedItem?.checked).toBe(!shoppingItem.checked);
    expect(
      getLedgerActivityHistory({ actingTripMemberId: getTripMembers(getCurrentTrip().id)[0]?.id ?? "" }).some(
        (activity) => activity.message.includes(shoppingItem.label)
      )
    ).toBe(true);
    expect(() => toggleTripListItem({ kind: "packing", itemId: shoppingItem.id })).toThrow(
      /list item not found/i
    );
  });

  it("deletes a committed list item", () => {
    const shoppingItem = getTripListsByKind("shopping")[0]?.items[0];

    if (!shoppingItem) {
      throw new Error("expected seeded shopping item");
    }

    deleteTripListItem({ kind: "shopping", itemId: shoppingItem.id });

    expect(
      getTripListsByKind("shopping")[0]?.items.some((item) => item.id === shoppingItem.id)
    ).toBe(false);
    expect(
      getLedgerActivityHistory({ actingTripMemberId: getTripMembers(getCurrentTrip().id)[0]?.id ?? "" }).some(
        (activity) => activity.message.includes(`Deleted shopping item "${shoppingItem.label}"`)
      )
    ).toBe(true);
  });

  it("keeps a locally deleted list item hidden across remote hydration until cloud delete lands", () => {
    const shoppingList = getTripListsByKind("shopping")[0];
    const shoppingItem = shoppingList?.items[0];

    if (!shoppingList || !shoppingItem) {
      throw new Error("expected seeded shopping item");
    }

    deleteTripListItem({ kind: "shopping", itemId: shoppingItem.id });

    hydrateCurrentTripStoreFromRemote({
      lists: [
        {
          ...shoppingList,
          items: [...shoppingList.items]
        }
      ],
      ledgerEntries: [],
      failedLogs: []
    });

    expect(getTripListsByKind("shopping")[0]?.items.some((item) => item.id === shoppingItem.id)).toBe(false);
  });

  it("learns autocomplete suggestions from family history across trips", () => {
    createTripFromCurrentMembers({
      createdByUserId: "user-owner-001",
      destination: "Kyoto",
      startsOn: "2026-11-01",
      endsOn: "2026-11-10",
      currency: "JPY"
    });

    const suggestions = getListSuggestions("shopping", "su");

    expect(suggestions.some((label) => label.toLowerCase() === "sunscreen")).toBe(true);
  });
});
