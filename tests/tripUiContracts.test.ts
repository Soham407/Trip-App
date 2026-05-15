import { describe, expect, it } from "vitest";

import {
  addTripCustomCategory,
  getLedgerEntries,
  getTripCustomCategories,
  resetCurrentTripStoreForTests
} from "@/data/currentTripStore";
import { resetTripIdentityStoreForTests } from "@/data/tripIdentityStore";
import {
  TRIP_CATEGORIES,
  buildTripCategories,
  buildLedgerFeedRows,
  resolveCategoryLabel
} from "@/components/trip-ui/contracts";
import { beforeEach } from "vitest";

describe("trip UI contracts", () => {
  beforeEach(() => {
    resetTripIdentityStoreForTests();
    resetCurrentTripStoreForTests();
  });

  it("preserves parent category with optional subcategory model", () => {
    expect(TRIP_CATEGORIES.length).toBeGreaterThan(0);

    const parentOnly = TRIP_CATEGORIES.find((category) => !category.subcategories?.length);
    const parentWithChildren = TRIP_CATEGORIES.find((category) => category.subcategories?.length);

    expect(parentOnly).toBeDefined();
    expect(parentWithChildren).toBeDefined();

    if (!parentWithChildren || !parentWithChildren.subcategories?.length) {
      throw new Error("expected at least one parent category with subcategories");
    }

    expect(resolveCategoryLabel(parentWithChildren.id)).toBe(parentWithChildren.label);
    expect(resolveCategoryLabel(parentWithChildren.id, parentWithChildren.subcategories[0].id)).toBe(
      `${parentWithChildren.label} / ${parentWithChildren.subcategories[0].label}`
    );
  });

  it("merges custom categories into the picker and label resolver", () => {
    const customParent = addTripCustomCategory({ label: "Fuel" });
    const customChild = addTripCustomCategory({
      label: "Diesel",
      parentCategoryId: customParent.id
    });
    const categories = buildTripCategories(getTripCustomCategories());

    expect(categories.some((category) => category.id === customParent.id)).toBe(true);
    expect(resolveCategoryLabel(customParent.id, customChild.id, categories)).toBe("Fuel / Diesel");
  });

  it("maps ledger entries into sorted transaction feed rows", () => {
    const feedRows = buildLedgerFeedRows(getLedgerEntries(), "INR");

    expect(feedRows.length).toBe(getLedgerEntries().length);
    expect(feedRows[0].createdAt >= feedRows[1].createdAt).toBe(true);
    expect(feedRows[0].amountLabel.startsWith("-₹")).toBe(true);
    expect(feedRows[0].meta.includes("Paid by")).toBe(true);
    expect(feedRows[0].categoryLabel.length).toBeGreaterThan(0);
  });
});
