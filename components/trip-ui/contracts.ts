import type { LedgerEntry } from "@/data/currentTripStore";

export type TripSubcategory = {
  readonly id: string;
  readonly label: string;
};

export type TripCategory = {
  readonly id: string;
  readonly label: string;
  readonly subcategories?: readonly TripSubcategory[];
};

export type LedgerFeedRow = {
  readonly id: string;
  readonly title: string;
  readonly amountLabel: string;
  readonly meta: string;
  readonly categoryLabel: string;
  readonly createdAt: string;
};

export const TRIP_CATEGORIES: readonly TripCategory[] = [
  {
    id: "transport",
    label: "Transport",
    subcategories: [
      { id: "transit", label: "Transit" },
      { id: "taxi", label: "Taxi" },
      { id: "rental", label: "Rental car" }
    ]
  },
  {
    id: "stay",
    label: "Stay",
    subcategories: [
      { id: "hotel", label: "Hotel" },
      { id: "deposit", label: "Deposit" }
    ]
  },
  {
    id: "meals",
    label: "Meals",
    subcategories: [
      { id: "groceries", label: "Groceries" },
      { id: "dining", label: "Dining out" }
    ]
  },
  {
    id: "shared",
    label: "Shared supplies"
  }
];

export function resolveCategoryLabel(parentId?: string, subcategoryId?: string): string {
  if (!parentId) {
    return "Uncategorized";
  }

  const parent = TRIP_CATEGORIES.find((category) => category.id === parentId);

  if (!parent) {
    return "Uncategorized";
  }

  if (!subcategoryId) {
    return parent.label;
  }

  const subcategory = parent.subcategories?.find((candidate) => candidate.id === subcategoryId);

  if (!subcategory) {
    return parent.label;
  }

  return `${parent.label} / ${subcategory.label}`;
}

export function getSubcategoriesForParent(parentId?: string): readonly TripSubcategory[] {
  if (!parentId) {
    return [];
  }

  const parent = TRIP_CATEGORIES.find((category) => category.id === parentId);

  return parent?.subcategories ?? [];
}

export function buildLedgerFeedRows(
  entries: readonly LedgerEntry[],
  currency: string
): readonly LedgerFeedRow[] {
  return [...entries]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((entry) => {
      const metaParts = [`Paid by ${entry.paidBy}`];

      if (entry.isCash) {
        metaParts.push("Cash");
      }

      if (entry.syncStatus === "pending") {
        metaParts.push("Pending sync");
      }

      if (entry.deletedAt) {
        metaParts.push("Soft deleted");
      }

      return {
        id: entry.id,
        title: entry.label,
        amountLabel: `${currency} ${entry.amount.toFixed(2)}`,
        meta: metaParts.join(" • "),
        categoryLabel: entry.deletedAt
          ? "Deleted"
          : resolveCategoryLabel(entry.categoryParentId, entry.categorySubcategoryId),
        createdAt: entry.createdAt
      };
    });
}
