export type CurrentTrip = {
  readonly id: string;
  readonly destination: string;
  readonly travelerCount: number;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly currency: string;
};

export type DashboardSnapshot = {
  readonly tripId: string;
  readonly title: string;
  readonly checklistProgress: number;
  readonly entryCount: number;
};

export type PackingList = {
  readonly id: string;
  readonly tripId: string;
  readonly title: string;
  readonly items: readonly { readonly id: string; readonly label: string; readonly packed: boolean }[];
};

export type LedgerEntry = {
  readonly id: string;
  readonly tripId: string;
  readonly label: string;
  readonly amount: number;
  readonly paidBy: string;
  readonly createdAt: string;
  readonly categoryParentId: string;
  readonly categorySubcategoryId?: string;
};

const currentTrip: CurrentTrip = {
  id: "trip-active-001",
  destination: "Lisbon",
  travelerCount: 4,
  startsOn: "2026-06-12",
  endsOn: "2026-06-19",
  currency: "EUR"
};

const packingLists: readonly PackingList[] = [
  {
    id: "list-core",
    tripId: currentTrip.id,
    title: "Core Carry-On",
    items: [
      { id: "item-passport", label: "Passport", packed: true },
      { id: "item-charger", label: "Phone charger", packed: false },
      { id: "item-adapter", label: "Universal adapter", packed: false }
    ]
  }
];

const ledgerEntries: readonly LedgerEntry[] = [
  {
    id: "entry-001",
    tripId: currentTrip.id,
    label: "Metro cards",
    amount: 29.5,
    paidBy: "Soham",
    createdAt: "2026-05-01T09:30:00Z",
    categoryParentId: "transport",
    categorySubcategoryId: "transit"
  },
  {
    id: "entry-002",
    tripId: currentTrip.id,
    label: "Apartment deposit",
    amount: 120,
    paidBy: "Ava",
    createdAt: "2026-05-02T14:15:00Z",
    categoryParentId: "stay",
    categorySubcategoryId: "deposit"
  }
];

export function getCurrentTrip(): CurrentTrip {
  return currentTrip;
}

export function getPackingLists(): readonly PackingList[] {
  return packingLists;
}

export function getLedgerEntries(): readonly LedgerEntry[] {
  return ledgerEntries;
}

export function getDashboardSnapshot(): DashboardSnapshot {
  const totalChecklistItems = packingLists.reduce((count, list) => count + list.items.length, 0);
  const packedItems = packingLists.reduce(
    (count, list) => count + list.items.filter((item) => item.packed).length,
    0
  );

  return {
    tripId: currentTrip.id,
    title: `${currentTrip.destination} active trip`,
    checklistProgress: totalChecklistItems === 0 ? 0 : packedItems / totalChecklistItems,
    entryCount: ledgerEntries.length
  };
}
