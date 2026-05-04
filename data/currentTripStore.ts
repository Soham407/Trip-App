import {
  getAllTripIdentities,
  getCurrentTripIdentity,
  getTripMembers
} from "@/data/tripIdentityStore";

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

export type TripListKind = "shopping" | "packing";

export type TripListItem = {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
};

export type TripList = {
  readonly id: string;
  readonly tripId: string;
  readonly kind: TripListKind;
  readonly title: string;
  readonly items: readonly TripListItem[];
};

export type ShoppingList = TripList & {
  readonly kind: "shopping";
};

export type PackingList = {
  readonly id: string;
  readonly tripId: string;
  readonly kind: "packing";
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

export const NO_NETWORK_VOICE_DICTATION_MESSAGE =
  "No network connection. Connect to the internet to use voice dictation.";

export type VoiceDictationReviewCandidate = {
  readonly id: string;
  readonly label: string;
};

export type VoiceDictationReview = {
  readonly tripId: string;
  readonly kind: TripListKind;
  readonly utterance: string;
  readonly candidates: readonly VoiceDictationReviewCandidate[];
};

const INITIAL_LISTS_BY_TRIP: Record<string, readonly TripList[]> = {
  "trip-active-001": [
    {
      id: "list-shopping-core",
      tripId: "trip-active-001",
      kind: "shopping",
      title: "Shopping",
      items: [
        { id: "shop-item-001", label: "Sunscreen", checked: false },
        { id: "shop-item-002", label: "Snacks", checked: false }
      ]
    },
    {
      id: "list-packing-core",
      tripId: "trip-active-001",
      kind: "packing",
      title: "Packing",
      items: [
        { id: "item-passport", label: "Passport", checked: true },
        { id: "item-charger", label: "Phone charger", checked: false },
        { id: "item-adapter", label: "Universal adapter", checked: false }
      ]
    }
  ],
  "trip-archive-001": [
    {
      id: "list-shopping-history",
      tripId: "trip-archive-001",
      kind: "shopping",
      title: "Shopping",
      items: [
        { id: "shop-item-h-001", label: "Sunscreen", checked: true },
        { id: "shop-item-h-002", label: "Laundry pods", checked: true }
      ]
    },
    {
      id: "list-packing-history",
      tripId: "trip-archive-001",
      kind: "packing",
      title: "Packing",
      items: [
        { id: "pack-item-h-001", label: "Rain jacket", checked: true },
        { id: "pack-item-h-002", label: "Walking shoes", checked: true }
      ]
    }
  ]
};

const ledgerEntriesByTrip: Record<string, readonly LedgerEntry[]> = {
  "trip-active-001": [
    {
      id: "entry-001",
      tripId: "trip-active-001",
      label: "Metro cards",
      amount: 29.5,
      paidBy: "Soham",
      createdAt: "2026-05-01T09:30:00Z",
      categoryParentId: "transport",
      categorySubcategoryId: "transit"
    },
    {
      id: "entry-002",
      tripId: "trip-active-001",
      label: "Apartment deposit",
      amount: 120,
      paidBy: "Ava",
      createdAt: "2026-05-02T14:15:00Z",
      categoryParentId: "stay",
      categorySubcategoryId: "deposit"
    }
  ]
};

let listItemSequence = 300;
let voiceCandidateSequence = 400;
let listsByTrip = cloneListsByTrip(INITIAL_LISTS_BY_TRIP);

function cloneListItem(item: TripListItem): TripListItem {
  return { ...item };
}

function cloneTripList(list: TripList): TripList {
  return {
    ...list,
    items: list.items.map(cloneListItem)
  };
}

function cloneListsByTrip(source: Record<string, readonly TripList[]>): Record<string, TripList[]> {
  return Object.fromEntries(
    Object.entries(source).map(([tripId, lists]) => [tripId, lists.map(cloneTripList)])
  );
}

function nextListItemId(): string {
  listItemSequence += 1;
  return `list-item-${String(listItemSequence).padStart(4, "0")}`;
}

function nextVoiceCandidateId(): string {
  voiceCandidateSequence += 1;
  return `voice-candidate-${String(voiceCandidateSequence).padStart(4, "0")}`;
}

function ensureTripLists(tripId: string): TripList[] {
  const existing = listsByTrip[tripId];

  if (existing) {
    return existing;
  }

  const seeded: TripList[] = [
    {
      id: `list-shopping-${tripId}`,
      tripId,
      kind: "shopping",
      title: "Shopping",
      items: []
    },
    {
      id: `list-packing-${tripId}`,
      tripId,
      kind: "packing",
      title: "Packing",
      items: []
    }
  ];

  listsByTrip[tripId] = seeded;
  return seeded;
}

function normalizeItemLabel(value: string): string {
  return value
    .replace(/^[\-•*\d.\)\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDictationUtterance(utterance: string): string[] {
  const rawParts = utterance.split(/\n|,|;|\band\b/gi);
  const deduped = new Map<string, string>();

  rawParts.forEach((part) => {
    const label = normalizeItemLabel(part);

    if (!label) {
      return;
    }

    const key = label.toLowerCase();

    if (!deduped.has(key)) {
      deduped.set(key, label);
    }
  });

  return [...deduped.values()];
}

function getFamilyHistoryTripIdsForCurrentTrip(): Set<string> {
  const currentTrip = getCurrentTrip();
  const currentTripEmails = new Set(
    getTripMembers(currentTrip.id).map((member) => member.email.trim().toLowerCase())
  );

  const familyTripIds = new Set<string>();

  getAllTripIdentities().forEach((trip) => {
    const members = getTripMembers(trip.id);
    const hasOverlap = members.some((member) => currentTripEmails.has(member.email.trim().toLowerCase()));

    if (hasOverlap) {
      familyTripIds.add(trip.id);
    }
  });

  Object.keys(listsByTrip).forEach((tripId) => {
    if (!familyTripIds.has(tripId) && tripId !== currentTrip.id) {
      return;
    }

    familyTripIds.add(tripId);
  });

  familyTripIds.add(currentTrip.id);
  return familyTripIds;
}

export function resetCurrentTripStoreForTests(): void {
  listItemSequence = 300;
  voiceCandidateSequence = 400;
  listsByTrip = cloneListsByTrip(INITIAL_LISTS_BY_TRIP);
}

export function getCurrentTrip(): CurrentTrip {
  const activeTrip = getCurrentTripIdentity();
  const members = getTripMembers(activeTrip.id);

  return {
    id: activeTrip.id,
    destination: activeTrip.destination,
    travelerCount: members.length,
    startsOn: activeTrip.startsOn,
    endsOn: activeTrip.endsOn,
    currency: activeTrip.currency
  };
}

export function getTripListsByKind(kind: TripListKind): readonly TripList[] {
  const tripId = getCurrentTrip().id;

  return ensureTripLists(tripId)
    .filter((list) => list.kind === kind)
    .map(cloneTripList);
}

export function getShoppingLists(): readonly ShoppingList[] {
  return getTripListsByKind("shopping") as readonly ShoppingList[];
}

export function getPackingLists(): readonly PackingList[] {
  return getTripListsByKind("packing").map((list) => ({
    id: list.id,
    tripId: list.tripId,
    kind: "packing",
    title: list.title,
    items: list.items.map((item) => ({
      id: item.id,
      label: item.label,
      packed: item.checked
    }))
  }));
}

export function buildVoiceDictationReview(input: {
  readonly kind: TripListKind;
  readonly utterance: string;
  readonly isOnline: boolean;
}):
  | { readonly status: "blocked"; readonly message: string }
  | { readonly status: "ready"; readonly review: VoiceDictationReview } {
  if (!input.isOnline) {
    return {
      status: "blocked",
      message: NO_NETWORK_VOICE_DICTATION_MESSAGE
    };
  }

  const labels = parseDictationUtterance(input.utterance);

  return {
    status: "ready",
    review: {
      tripId: getCurrentTrip().id,
      kind: input.kind,
      utterance: input.utterance,
      candidates: labels.map((label) => ({
        id: nextVoiceCandidateId(),
        label
      }))
    }
  };
}

export function removeVoiceDictationReviewItem(input: {
  readonly review: VoiceDictationReview;
  readonly candidateId: string;
}): VoiceDictationReview {
  return {
    ...input.review,
    candidates: input.review.candidates.filter((candidate) => candidate.id !== input.candidateId)
  };
}

export function commitVoiceDictationReview(
  review: VoiceDictationReview
): { readonly listId: string; readonly addedCount: number } {
  const tripLists = ensureTripLists(review.tripId);
  const targetList = tripLists.find((list) => list.kind === review.kind);

  if (!targetList) {
    throw new Error(`List kind not found for trip: ${review.kind}`);
  }

  const nextItems = review.candidates.map((candidate) => ({
    id: nextListItemId(),
    label: candidate.label,
    checked: false
  }));

  const updatedList: TripList = {
    ...targetList,
    items: [...targetList.items, ...nextItems]
  };

  listsByTrip[review.tripId] = tripLists.map((list) =>
    list.id === targetList.id ? updatedList : list
  );

  return {
    listId: updatedList.id,
    addedCount: nextItems.length
  };
}

export function getListSuggestions(kind: TripListKind, query: string): readonly string[] {
  const familyTripIds = getFamilyHistoryTripIdsForCurrentTrip();
  const normalizedQuery = query.trim().toLowerCase();
  const labels = new Map<string, string>();

  familyTripIds.forEach((tripId) => {
    const tripLists = ensureTripLists(tripId);

    tripLists
      .filter((list) => list.kind === kind)
      .forEach((list) => {
        list.items.forEach((item) => {
          const normalizedLabel = item.label.trim().toLowerCase();

          if (!labels.has(normalizedLabel)) {
            labels.set(normalizedLabel, item.label);
          }
        });
      });
  });

  return [...labels.values()]
    .filter((label) => {
      if (!normalizedQuery) {
        return true;
      }

      return label.toLowerCase().includes(normalizedQuery);
    })
    .sort((left, right) => left.localeCompare(right));
}

export function getLedgerEntries(): readonly LedgerEntry[] {
  const tripId = getCurrentTrip().id;
  return ledgerEntriesByTrip[tripId] ?? [];
}

export function getDashboardSnapshot(): DashboardSnapshot {
  const currentTrip = getCurrentTrip();
  const packingLists = getPackingLists();
  const ledgerEntries = getLedgerEntries();

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
