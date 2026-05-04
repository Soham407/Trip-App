import { describe, expect, it } from "vitest";

import { getLedgerEntries } from "@/data/currentTripStore";
import {
  TRIP_CATEGORIES,
  buildLedgerFeedRows,
  resolveCategoryLabel
} from "@/components/trip-ui/contracts";

describe("trip UI contracts", () => {
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

  it("maps ledger entries into sorted transaction feed rows", () => {
    const feedRows = buildLedgerFeedRows(getLedgerEntries(), "EUR");

    expect(feedRows.length).toBe(getLedgerEntries().length);
    expect(feedRows[0].createdAt >= feedRows[1].createdAt).toBe(true);
    expect(feedRows[0].amountLabel.startsWith("EUR ")).toBe(true);
    expect(feedRows[0].meta.includes("Paid by")).toBe(true);
    expect(feedRows[0].categoryLabel.length).toBeGreaterThan(0);
  });
});
