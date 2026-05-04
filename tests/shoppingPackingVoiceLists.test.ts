import { beforeEach, describe, expect, it } from "vitest";

import { createTripFromCurrentMembers, resetTripIdentityStoreForTests } from "@/data/tripIdentityStore";
import {
  NO_NETWORK_VOICE_DICTATION_MESSAGE,
  buildVoiceDictationReview,
  commitVoiceDictationReview,
  getListSuggestions,
  getShoppingLists,
  getTripListsByKind,
  removeVoiceDictationReviewItem,
  resetCurrentTripStoreForTests
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
