import {
  getAllTripIdentities,
  getCurrentTripIdentity,
  getPrimaryAdminTripMember,
  getTripMembers
} from "@/data/tripIdentityStore";
import {
  readRepositoryState,
  resetRepositoryState,
  writeRepositoryState,
  type SyncStatus
} from "@/data/localFirstRepository";
import {
  isParseFailure,
  parseImportedExpensePayload
} from "@/data/expenseAlertParser";
import { supabase } from "@/data/supabaseClient";

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
  readonly needsReviewCount: number;
};

export type TripListKind = "shopping" | "packing";

export type TripListItem = {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly syncStatus?: SyncStatus;
};

export type TripList = {
  readonly id: string;
  readonly tripId: string;
  readonly kind: TripListKind;
  readonly title: string;
  readonly items: readonly TripListItem[];
  readonly syncStatus?: SyncStatus;
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

export type LedgerEntryStatus = "categorized" | "imported-uncategorized";
export type LedgerEntrySource = "manual" | "email" | "webhook";
export type LedgerEntrySyncStatus = "synced" | "pending";

export type LedgerEntry = {
  readonly id: string;
  readonly tripId: string;
  readonly label: string;
  readonly amount: number;
  readonly paidBy: string;
  readonly createdAt: string;
  readonly categoryParentId?: string;
  readonly categorySubcategoryId?: string;
  readonly status: LedgerEntryStatus;
  readonly source: LedgerEntrySource;
  readonly syncStatus: LedgerEntrySyncStatus;
  readonly isCash?: boolean;
  readonly deletedAt?: string;
  readonly deletedByTripMemberId?: string;
  readonly updatedByTripMemberId?: string;
};

export type LedgerActivityType =
  | "manual-cash-entry-added"
  | "manual-entry-sync-confirmed"
  | "imported-entry-categorized"
  | "imported-entry-uncategorized"
  | "soft-delete"
  | "hard-delete";

export type LedgerActivity = {
  readonly id: string;
  readonly tripId: string;
  readonly ledgerEntryId?: string;
  readonly actingTripMemberId: string;
  readonly type: LedgerActivityType;
  readonly message: string;
  readonly createdAt: string;
};

export type AddManualCashLedgerEntryInput = {
  readonly label: string;
  readonly amount: number;
  readonly paidBy: string;
  readonly actingTripMemberId: string;
};

export type ConfirmManualLedgerEntrySyncInput = {
  readonly ledgerEntryId: string;
  readonly actingTripMemberId: string;
};

export type SoftDeleteLedgerEntryInput = {
  readonly ledgerEntryId: string;
  readonly actingTripMemberId: string;
};

export type HardDeleteLedgerEntryInput = {
  readonly ledgerEntryId: string;
  readonly actingTripMemberId: string;
};

type LedgerEditLock = {
  readonly id: string;
  readonly tripId: string;
  readonly ledgerEntryId: string;
  readonly actingTripMemberId: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
};

export type RequestLedgerEntryEditLockInput = {
  readonly ledgerEntryId: string;
  readonly actingTripMemberId: string;
  readonly nowIso?: string;
};

export type ConfirmLedgerEntryEditLockInput = {
  readonly ledgerEntryId: string;
  readonly actingTripMemberId: string;
  readonly lockId: string;
  readonly nowIso?: string;
};

export type RequestLedgerEntryEditLockResult =
  | {
      readonly status: "granted";
      readonly lockId: string;
      readonly expiresAt: string;
    }
  | {
      readonly status: "conflict";
      readonly prompt: string;
      readonly expiresAt: string;
    };

export type IngestSharedExpenseAlertInput = {
  readonly source: "email" | "webhook";
  readonly payload: string;
};

export type CategorizeImportedExpenseInput = {
  readonly expenseId: string;
  readonly actingTripMemberId: string;
  readonly categoryParentId: string;
  readonly categorySubcategoryId?: string;
};

export type UncategorizedImportedExpenseInput = {
  readonly expenseId: string;
  readonly actingTripMemberId: string;
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

export type FailedExpenseIngestionLog = {
  readonly id: string;
  readonly tripId: string;
  readonly source: "email" | "webhook";
  readonly rawPayload: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly syncStatus: SyncStatus;
};

type CurrentTripStoreState = {
  sequence: number;
  timestampCursor: number;
  listItemSequence: number;
  voiceCandidateSequence: number;
  listsByTrip: Record<string, TripList[]>;
  ledgerEntriesByTrip: Record<string, LedgerEntry[]>;
  failedLogsByTrip: Record<string, FailedExpenseIngestionLog[]>;
  ledgerActivityByTrip: Record<string, LedgerActivity[]>;
  ledgerEditLocksByTrip: Record<string, LedgerEditLock[]>;
};

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

function cloneLedgerEntry(entry: LedgerEntry): LedgerEntry {
  return { ...entry };
}

function cloneFailedLog(log: FailedExpenseIngestionLog): FailedExpenseIngestionLog {
  return { ...log };
}

function cloneLedgerActivity(activity: LedgerActivity): LedgerActivity {
  return { ...activity };
}

function buildInitialState(): CurrentTripStoreState {
  return {
    sequence: 300,
    timestampCursor: 15,
    listItemSequence: 300,
    voiceCandidateSequence: 400,
    listsByTrip: cloneListsByTrip(INITIAL_LISTS_BY_TRIP),
    ledgerEntriesByTrip: {
      "trip-active-001": [
        {
          id: "entry-001",
          tripId: "trip-active-001",
          label: "Konkan toll plaza",
          amount: 1840,
          paidBy: "Soham",
          createdAt: "2026-05-01T09:30:00Z",
          categoryParentId: "transport",
          categorySubcategoryId: "transit",
          status: "categorized",
          source: "manual",
          syncStatus: "synced"
        },
        {
          id: "entry-002",
          tripId: "trip-active-001",
          label: "Beach stay deposit",
          amount: 12000,
          paidBy: "Ava",
          createdAt: "2026-05-02T14:15:00Z",
          categoryParentId: "stay",
          categorySubcategoryId: "deposit",
          status: "categorized",
          source: "manual",
          syncStatus: "synced"
        }
      ]
    },
    failedLogsByTrip: {
      "trip-active-001": []
    },
    ledgerActivityByTrip: {
      "trip-active-001": []
    },
    ledgerEditLocksByTrip: {
      "trip-active-001": []
    }
  };
}

let state: CurrentTripStoreState = readRepositoryState("current-trip", buildInitialState);

const listeners = new Set<() => void>();

function notifySubscribers(): void {
  writeRepositoryState("current-trip", state);
  listeners.forEach((listener) => listener());
}

function nextId(prefix: string): string {
  state.sequence += 1;
  return `${prefix}-${String(state.sequence).padStart(4, "0")}`;
}

function nextTimestamp(): string {
  state.timestampCursor += 1;
  return `2026-05-03T12:${String(state.timestampCursor).padStart(2, "0")}:00Z`;
}

function nextListItemId(): string {
  state.listItemSequence += 1;
  return `list-item-${String(state.listItemSequence).padStart(4, "0")}`;
}

function nextVoiceCandidateId(): string {
  state.voiceCandidateSequence += 1;
  return `voice-candidate-${String(state.voiceCandidateSequence).padStart(4, "0")}`;
}

const EDIT_LOCK_DURATION_MS = 30_000;

function toIso(input?: string): string {
  if (!input) {
    return new Date().toISOString();
  }

  return new Date(input).toISOString();
}

function lockExpiryIso(nowIso: string): string {
  return new Date(Date.parse(nowIso) + EDIT_LOCK_DURATION_MS).toISOString();
}

function getActiveTripId(): string {
  return getCurrentTripIdentity().id;
}

function ensureTripLists(tripId: string): TripList[] {
  const existing = state.listsByTrip[tripId];

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

  state.listsByTrip[tripId] = seeded;
  writeRepositoryState("current-trip", state);
  return seeded;
}

function assertTripMember(tripId: string, tripMemberId: string): void {
  const tripMembers = getTripMembers(tripId);
  const isMember = tripMembers.some((member) => member.id === tripMemberId);

  if (!isMember) {
    throw new Error(`Only a trip member can review shared expenses for trip ${tripId}`);
  }
}

function getPrimaryAdminTripMemberId(tripId: string): string {
  const primaryAdmin = getPrimaryAdminTripMember(tripId);

  if (!primaryAdmin) {
    throw new Error(`Primary admin is unavailable for trip ${tripId}`);
  }

  return primaryAdmin.id;
}

function findLedgerEntryIndex(tripId: string, ledgerEntryId: string): number {
  const entries = state.ledgerEntriesByTrip[tripId] ?? [];
  return entries.findIndex((entry) => entry.id === ledgerEntryId);
}

function ensureLedgerEditLocks(tripId: string): LedgerEditLock[] {
  if (!state.ledgerEditLocksByTrip[tripId]) {
    state.ledgerEditLocksByTrip[tripId] = [];
  }

  return state.ledgerEditLocksByTrip[tripId] ?? [];
}

function removeExpiredEditLocks(tripId: string, nowIso: string): void {
  const existingLocks = ensureLedgerEditLocks(tripId);
  state.ledgerEditLocksByTrip[tripId] = existingLocks.filter(
    (lock) => Date.parse(lock.expiresAt) > Date.parse(nowIso)
  );
}

function appendLedgerActivity(activity: Omit<LedgerActivity, "id" | "createdAt">): void {
  const createdAt = nextTimestamp();
  const tripActivities = state.ledgerActivityByTrip[activity.tripId] ?? [];

  const nextActivity: LedgerActivity = {
    id: nextId("ledger-activity"),
    createdAt,
    ...activity
  };

  state.ledgerActivityByTrip[activity.tripId] = [...tripActivities, nextActivity];
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

  Object.keys(state.listsByTrip).forEach((tripId) => {
    if (!familyTripIds.has(tripId) && tripId !== currentTrip.id) {
      return;
    }

    familyTripIds.add(tripId);
  });

  familyTripIds.add(currentTrip.id);
  return familyTripIds;
}

export function resetCurrentTripStoreForTests(): void {
  state = resetRepositoryState("current-trip", buildInitialState());
  notifySubscribers();
}

export function hydrateCurrentTripStoreFromRemote(input: {
  readonly lists: readonly TripList[];
  readonly ledgerEntries: readonly LedgerEntry[];
  readonly failedLogs: readonly FailedExpenseIngestionLog[];
  readonly ledgerActivities?: readonly LedgerActivity[];
}): void {
  const listsByTrip: Record<string, TripList[]> = {};
  const ledgerEntriesByTrip: Record<string, LedgerEntry[]> = {};
  const failedLogsByTrip: Record<string, FailedExpenseIngestionLog[]> = {};
  const ledgerActivityByTrip: Record<string, LedgerActivity[]> = {};

  input.lists.forEach((list) => {
    listsByTrip[list.tripId] = [...(listsByTrip[list.tripId] ?? []), cloneTripList(list)];
  });

  input.ledgerEntries.forEach((entry) => {
    ledgerEntriesByTrip[entry.tripId] = [
      ...(ledgerEntriesByTrip[entry.tripId] ?? []),
      cloneLedgerEntry(entry)
    ];
  });

  input.failedLogs.forEach((log) => {
    failedLogsByTrip[log.tripId] = [...(failedLogsByTrip[log.tripId] ?? []), cloneFailedLog(log)];
  });

  input.ledgerActivities?.forEach((activity) => {
    ledgerActivityByTrip[activity.tripId] = [
      ...(ledgerActivityByTrip[activity.tripId] ?? []),
      cloneLedgerActivity(activity)
    ];
  });

  state = {
    sequence: 1000,
    timestampCursor: 10,
    listItemSequence: 1000,
    voiceCandidateSequence: 1000,
    listsByTrip,
    ledgerEntriesByTrip,
    failedLogsByTrip,
    ledgerActivityByTrip,
    ledgerEditLocksByTrip: {}
  };
  notifySubscribers();
}

function persistListItemToCloud(listId: string, item: TripListItem): void {
  void supabase
    .from("trip_list_items")
    .upsert({
      id: item.id,
      list_id: listId,
      label: item.label,
      checked: item.checked,
      sync_status: item.syncStatus ?? "pending"
    })
    .then(({ error }) => {
      if (error) {
        console.error("Supabase list item sync failed", error.message);
      }
    });
}

function persistLedgerEntryToCloud(entry: LedgerEntry): void {
  void supabase
    .from("ledger_entries")
    .upsert({
      id: entry.id,
      trip_id: entry.tripId,
      label: entry.label,
      amount: entry.amount,
      paid_by: entry.paidBy,
      created_at: entry.createdAt,
      category_parent_id: entry.categoryParentId ?? null,
      category_subcategory_id: entry.categorySubcategoryId ?? null,
      status: entry.status,
      source: entry.source,
      sync_status: entry.syncStatus,
      is_cash: entry.isCash ?? false,
      deleted_at: entry.deletedAt ?? null,
      deleted_by_trip_member_id: entry.deletedByTripMemberId ?? null,
      updated_by_trip_member_id: entry.updatedByTripMemberId ?? null
    })
    .then(({ error }) => {
      if (error) {
        console.error("Supabase ledger sync failed", error.message);
      }
    });
}

function persistFailedLogToCloud(log: FailedExpenseIngestionLog): void {
  void supabase
    .from("failed_expense_ingestion_logs")
    .upsert({
      id: log.id,
      trip_id: log.tripId,
      source: log.source,
      raw_payload: log.rawPayload,
      reason: log.reason,
      created_at: log.createdAt,
      sync_status: log.syncStatus
    })
    .then(({ error }) => {
      if (error) {
        console.error("Supabase failed import sync failed", error.message);
      }
    });
}

export function subscribeCurrentTripStore(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
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

  state.listsByTrip[review.tripId] = tripLists.map((list) =>
    list.id === targetList.id ? updatedList : list
  );

  nextItems.forEach((item) => persistListItemToCloud(targetList.id, item));
  notifySubscribers();

  return {
    listId: updatedList.id,
    addedCount: nextItems.length
  };
}

export function toggleTripListItem(input: {
  readonly kind: TripListKind;
  readonly itemId: string;
}): TripListItem {
  const tripId = getCurrentTrip().id;
  const tripLists = ensureTripLists(tripId);
  const targetList = tripLists.find((list) =>
    list.kind === input.kind && list.items.some((item) => item.id === input.itemId)
  );

  if (!targetList) {
    throw new Error(`List item not found: ${input.itemId}`);
  }

  let toggledItem: TripListItem | undefined;
  const updatedList: TripList = {
    ...targetList,
    items: targetList.items.map((item) => {
      if (item.id !== input.itemId) {
        return item;
      }

      toggledItem = { ...item, checked: !item.checked };
      return toggledItem;
    })
  };

  state.listsByTrip[tripId] = tripLists.map((list) =>
    list.id === targetList.id ? updatedList : list
  );

  if (toggledItem) {
    persistListItemToCloud(targetList.id, toggledItem);
  }
  notifySubscribers();

  if (!toggledItem) {
    throw new Error(`List item not found: ${input.itemId}`);
  }

  return cloneListItem(toggledItem);
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
  const tripId = getActiveTripId();
  return [...(state.ledgerEntriesByTrip[tripId] ?? [])]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(cloneLedgerEntry);
}

export function getLedgerActivityHistory(input: {
  readonly actingTripMemberId: string;
}): readonly LedgerActivity[] {
  const tripId = getActiveTripId();
  assertTripMember(tripId, input.actingTripMemberId);

  return [...(state.ledgerActivityByTrip[tripId] ?? [])]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(cloneLedgerActivity);
}

export function requestLedgerEntryEditLock(
  input: RequestLedgerEntryEditLockInput
): RequestLedgerEntryEditLockResult {
  const tripId = getActiveTripId();
  assertTripMember(tripId, input.actingTripMemberId);

  const expenseIndex = findLedgerEntryIndex(tripId, input.ledgerEntryId);

  if (expenseIndex < 0) {
    throw new Error(`Ledger entry not found: ${input.ledgerEntryId}`);
  }

  const nowIso = toIso(input.nowIso);
  removeExpiredEditLocks(tripId, nowIso);

  const tripLocks = ensureLedgerEditLocks(tripId);
  const existingLock = tripLocks.find((lock) => lock.ledgerEntryId === input.ledgerEntryId);

  if (existingLock && existingLock.actingTripMemberId !== input.actingTripMemberId) {
    const lockOwner =
      getTripMembers(tripId).find((member) => member.id === existingLock.actingTripMemberId)?.displayName ??
      "another member";

    return {
      status: "conflict",
      prompt: `${lockOwner} is already editing this entry. Try again after lock expiry.`,
      expiresAt: existingLock.expiresAt
    };
  }

  const updatedLock: LedgerEditLock = {
    id: existingLock?.id ?? nextId("ledger-lock"),
    tripId,
    ledgerEntryId: input.ledgerEntryId,
    actingTripMemberId: input.actingTripMemberId,
    acquiredAt: nowIso,
    expiresAt: lockExpiryIso(nowIso)
  };

  state.ledgerEditLocksByTrip[tripId] = [
    ...tripLocks.filter((lock) => lock.ledgerEntryId !== input.ledgerEntryId),
    updatedLock
  ];

  notifySubscribers();

  return {
    status: "granted",
    lockId: updatedLock.id,
    expiresAt: updatedLock.expiresAt
  };
}

export function confirmLedgerEntryEditLock(input: ConfirmLedgerEntryEditLockInput): void {
  const tripId = getActiveTripId();
  assertTripMember(tripId, input.actingTripMemberId);

  const nowIso = toIso(input.nowIso);
  removeExpiredEditLocks(tripId, nowIso);

  const tripLocks = ensureLedgerEditLocks(tripId);
  const matchingLock = tripLocks.find(
    (lock) =>
      lock.id === input.lockId &&
      lock.ledgerEntryId === input.ledgerEntryId &&
      lock.actingTripMemberId === input.actingTripMemberId
  );

  if (!matchingLock) {
    throw new Error(`Edit lock not found for entry ${input.ledgerEntryId}`);
  }

  state.ledgerEditLocksByTrip[tripId] = tripLocks.filter((lock) => lock.id !== input.lockId);
  notifySubscribers();
}

export function addManualCashLedgerEntry(input: AddManualCashLedgerEntryInput): LedgerEntry {
  const tripId = getActiveTripId();
  assertTripMember(tripId, input.actingTripMemberId);

  const label = input.label.trim();
  const paidBy = input.paidBy.trim();

  if (!label) {
    throw new Error("Manual cash entry requires a label");
  }

  if (!paidBy) {
    throw new Error("Manual cash entry requires who paid");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Manual cash entry requires a positive amount");
  }

  const manualEntry: LedgerEntry = {
    id: nextId("entry-manual"),
    tripId,
    label,
    amount: input.amount,
    paidBy,
    createdAt: nextTimestamp(),
    status: "categorized",
    source: "manual",
    syncStatus: "pending",
    isCash: true,
    updatedByTripMemberId: input.actingTripMemberId
  };

  state.ledgerEntriesByTrip[tripId] = [...(state.ledgerEntriesByTrip[tripId] ?? []), manualEntry];
  appendLedgerActivity({
    tripId,
    ledgerEntryId: manualEntry.id,
    actingTripMemberId: input.actingTripMemberId,
    type: "manual-cash-entry-added",
    message: `Added manual cash entry "${manualEntry.label}".`
  });
  persistLedgerEntryToCloud(manualEntry);
  notifySubscribers();

  return cloneLedgerEntry(manualEntry);
}

export function confirmManualLedgerEntrySync(input: ConfirmManualLedgerEntrySyncInput): LedgerEntry {
  const tripId = getActiveTripId();
  assertTripMember(tripId, input.actingTripMemberId);

  const entries = state.ledgerEntriesByTrip[tripId] ?? [];
  const expenseIndex = entries.findIndex((entry) => entry.id === input.ledgerEntryId);

  if (expenseIndex < 0) {
    throw new Error(`Ledger entry not found: ${input.ledgerEntryId}`);
  }

  const target = entries[expenseIndex];

  if (!target || target.source !== "manual" || !target.isCash) {
    throw new Error(`Manual cash entry not found: ${input.ledgerEntryId}`);
  }

  const syncedEntry: LedgerEntry = {
    ...target,
    syncStatus: "synced",
    updatedByTripMemberId: input.actingTripMemberId
  };

  entries[expenseIndex] = syncedEntry;
  appendLedgerActivity({
    tripId,
    ledgerEntryId: syncedEntry.id,
    actingTripMemberId: input.actingTripMemberId,
    type: "manual-entry-sync-confirmed",
    message: `Confirmed sync for manual entry "${syncedEntry.label}".`
  });
  persistLedgerEntryToCloud(syncedEntry);
  notifySubscribers();

  return cloneLedgerEntry(syncedEntry);
}

export function softDeleteLedgerEntry(input: SoftDeleteLedgerEntryInput): LedgerEntry {
  const tripId = getActiveTripId();
  assertTripMember(tripId, input.actingTripMemberId);

  const entries = state.ledgerEntriesByTrip[tripId] ?? [];
  const expenseIndex = entries.findIndex((entry) => entry.id === input.ledgerEntryId);

  if (expenseIndex < 0) {
    throw new Error(`Ledger entry not found: ${input.ledgerEntryId}`);
  }

  const target = entries[expenseIndex];

  if (!target) {
    throw new Error(`Ledger entry not found: ${input.ledgerEntryId}`);
  }

  if (target.deletedAt) {
    return cloneLedgerEntry(target);
  }

  const deleted: LedgerEntry = {
    ...target,
    deletedAt: nextTimestamp(),
    deletedByTripMemberId: input.actingTripMemberId,
    updatedByTripMemberId: input.actingTripMemberId
  };

  entries[expenseIndex] = deleted;
  appendLedgerActivity({
    tripId,
    ledgerEntryId: deleted.id,
    actingTripMemberId: input.actingTripMemberId,
    type: "soft-delete",
    message: `Soft deleted ledger entry "${deleted.label}".`
  });
  persistLedgerEntryToCloud(deleted);
  notifySubscribers();

  return cloneLedgerEntry(deleted);
}

export function hardDeleteLedgerEntry(input: HardDeleteLedgerEntryInput): void {
  const tripId = getActiveTripId();
  assertTripMember(tripId, input.actingTripMemberId);

  if (input.actingTripMemberId !== getPrimaryAdminTripMemberId(tripId)) {
    throw new Error("Hard delete is allowed for the primary admin only");
  }

  const entries = state.ledgerEntriesByTrip[tripId] ?? [];
  const expenseIndex = entries.findIndex((entry) => entry.id === input.ledgerEntryId);

  if (expenseIndex < 0) {
    throw new Error(`Ledger entry not found: ${input.ledgerEntryId}`);
  }

  const removedEntry = entries[expenseIndex];

  if (!removedEntry) {
    throw new Error(`Ledger entry not found: ${input.ledgerEntryId}`);
  }

  state.ledgerEntriesByTrip[tripId] = entries.filter((entry) => entry.id !== input.ledgerEntryId);
  state.ledgerEditLocksByTrip[tripId] = ensureLedgerEditLocks(tripId).filter(
    (lock) => lock.ledgerEntryId !== input.ledgerEntryId
  );
  appendLedgerActivity({
    tripId,
    ledgerEntryId: input.ledgerEntryId,
    actingTripMemberId: input.actingTripMemberId,
    type: "hard-delete",
    message: `Hard deleted ledger entry "${removedEntry.label}".`
  });
  notifySubscribers();
}

export function getNeedsReviewExpenses(): readonly LedgerEntry[] {
  return getLedgerEntries()
    .filter((entry) => entry.status === "imported-uncategorized")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getFailedExpenseIngestionLog(): readonly FailedExpenseIngestionLog[] {
  const tripId = getActiveTripId();

  return [...(state.failedLogsByTrip[tripId] ?? [])]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(cloneFailedLog);
}

export function ingestSharedExpenseAlert(input: IngestSharedExpenseAlertInput): LedgerEntry | null {
  const tripId = getActiveTripId();
  const parsed = parseImportedExpensePayload(input.payload);

  if (isParseFailure(parsed)) {
    const failedLog: FailedExpenseIngestionLog = {
      id: nextId("expense-failed"),
      tripId,
      source: input.source,
      rawPayload: input.payload,
      reason: parsed.error,
      createdAt: nextTimestamp(),
      syncStatus: "pending"
    };

    state.failedLogsByTrip[tripId] = [...(state.failedLogsByTrip[tripId] ?? []), failedLog];
    persistFailedLogToCloud(failedLog);
    notifySubscribers();
    return null;
  }

  const importedExpense: LedgerEntry = {
    id: nextId("entry-import"),
    tripId,
    label: parsed.merchant,
    amount: parsed.amount,
    paidBy: "Imported alert",
    createdAt: parsed.timestamp,
    status: "imported-uncategorized",
    source: input.source,
    syncStatus: "synced"
  };

  state.ledgerEntriesByTrip[tripId] = [...(state.ledgerEntriesByTrip[tripId] ?? []), importedExpense];
  persistLedgerEntryToCloud(importedExpense);
  notifySubscribers();

  return cloneLedgerEntry(importedExpense);
}

export function categorizeImportedExpense(input: CategorizeImportedExpenseInput): LedgerEntry {
  const tripId = getActiveTripId();
  assertTripMember(tripId, input.actingTripMemberId);

  const entries = state.ledgerEntriesByTrip[tripId] ?? [];
  const expenseIndex = entries.findIndex((entry) => entry.id === input.expenseId);

  if (expenseIndex < 0) {
    throw new Error(`Imported expense not found: ${input.expenseId}`);
  }

  const target = entries[expenseIndex];

  if (!target || target.source === "manual") {
    throw new Error(`Imported expense not found: ${input.expenseId}`);
  }

  const categorized: LedgerEntry = {
    ...target,
    categoryParentId: input.categoryParentId,
    categorySubcategoryId: input.categorySubcategoryId,
    status: "categorized",
    updatedByTripMemberId: input.actingTripMemberId
  };

  entries[expenseIndex] = categorized;
  appendLedgerActivity({
    tripId,
    ledgerEntryId: categorized.id,
    actingTripMemberId: input.actingTripMemberId,
    type: "imported-entry-categorized",
    message: `Categorized imported entry "${categorized.label}".`
  });
  persistLedgerEntryToCloud(categorized);
  notifySubscribers();

  return cloneLedgerEntry(categorized);
}

export function uncategorizeImportedExpense(input: UncategorizedImportedExpenseInput): LedgerEntry {
  const tripId = getActiveTripId();
  assertTripMember(tripId, input.actingTripMemberId);

  const entries = state.ledgerEntriesByTrip[tripId] ?? [];
  const expenseIndex = entries.findIndex((entry) => entry.id === input.expenseId);

  if (expenseIndex < 0) {
    throw new Error(`Imported expense not found: ${input.expenseId}`);
  }

  const target = entries[expenseIndex];

  if (!target || target.source === "manual") {
    throw new Error(`Imported expense not found: ${input.expenseId}`);
  }

  const uncategorized: LedgerEntry = {
    ...target,
    categoryParentId: undefined,
    categorySubcategoryId: undefined,
    status: "imported-uncategorized",
    updatedByTripMemberId: input.actingTripMemberId
  };

  entries[expenseIndex] = uncategorized;
  appendLedgerActivity({
    tripId,
    ledgerEntryId: uncategorized.id,
    actingTripMemberId: input.actingTripMemberId,
    type: "imported-entry-uncategorized",
    message: `Marked imported entry "${uncategorized.label}" as uncategorized.`
  });
  persistLedgerEntryToCloud(uncategorized);
  notifySubscribers();

  return cloneLedgerEntry(uncategorized);
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
    entryCount: ledgerEntries.length,
    needsReviewCount: getNeedsReviewExpenses().length
  };
}
