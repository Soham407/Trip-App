import { getCurrentTripIdentity, getTripMembers } from "@/data/tripIdentityStore";

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

export type PackingList = {
  readonly id: string;
  readonly tripId: string;
  readonly title: string;
  readonly items: readonly { readonly id: string; readonly label: string; readonly packed: boolean }[];
};

export type LedgerEntryStatus = "categorized" | "imported-uncategorized";
export type LedgerEntrySource = "manual" | "email" | "webhook";

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
  readonly updatedByTripMemberId?: string;
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

export type FailedExpenseIngestionLog = {
  readonly id: string;
  readonly tripId: string;
  readonly source: "email" | "webhook";
  readonly rawPayload: string;
  readonly reason: string;
  readonly createdAt: string;
};

type CurrentTripStoreState = {
  sequence: number;
  timestampCursor: number;
  packingListsByTrip: Record<string, PackingList[]>;
  ledgerEntriesByTrip: Record<string, LedgerEntry[]>;
  failedLogsByTrip: Record<string, FailedExpenseIngestionLog[]>;
};

function clonePackingList(list: PackingList): PackingList {
  return {
    ...list,
    items: list.items.map((item) => ({ ...item }))
  };
}

function cloneLedgerEntry(entry: LedgerEntry): LedgerEntry {
  return { ...entry };
}

function cloneFailedLog(log: FailedExpenseIngestionLog): FailedExpenseIngestionLog {
  return { ...log };
}

function buildInitialState(): CurrentTripStoreState {
  return {
    sequence: 300,
    timestampCursor: 15,
    packingListsByTrip: {
      "trip-active-001": [
        {
          id: "list-core",
          tripId: "trip-active-001",
          title: "Core Carry-On",
          items: [
            { id: "item-passport", label: "Passport", packed: true },
            { id: "item-charger", label: "Phone charger", packed: false },
            { id: "item-adapter", label: "Universal adapter", packed: false }
          ]
        }
      ]
    },
    ledgerEntriesByTrip: {
      "trip-active-001": [
        {
          id: "entry-001",
          tripId: "trip-active-001",
          label: "Metro cards",
          amount: 29.5,
          paidBy: "Soham",
          createdAt: "2026-05-01T09:30:00Z",
          categoryParentId: "transport",
          categorySubcategoryId: "transit",
          status: "categorized",
          source: "manual"
        },
        {
          id: "entry-002",
          tripId: "trip-active-001",
          label: "Apartment deposit",
          amount: 120,
          paidBy: "Ava",
          createdAt: "2026-05-02T14:15:00Z",
          categoryParentId: "stay",
          categorySubcategoryId: "deposit",
          status: "categorized",
          source: "manual"
        }
      ]
    },
    failedLogsByTrip: {
      "trip-active-001": []
    }
  };
}

let state: CurrentTripStoreState = buildInitialState();

const listeners = new Set<() => void>();

function notifySubscribers(): void {
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

function getActiveTripId(): string {
  return getCurrentTripIdentity().id;
}

function assertTripMember(tripId: string, tripMemberId: string): void {
  const tripMembers = getTripMembers(tripId);
  const isMember = tripMembers.some((member) => member.id === tripMemberId);

  if (!isMember) {
    throw new Error(`Only a trip member can review shared expenses for trip ${tripId}`);
  }
}

function normalizeAlertTimestamp(rawTimestamp: string | undefined): string | null {
  if (!rawTimestamp) {
    return null;
  }

  const normalized = rawTimestamp.trim();

  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(normalized)) {
    return normalized.replace(" ", "T") + ":00Z";
  }

  const parsed = Date.parse(normalized);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function parseBankAlert(payload: string):
  | { readonly amount: number; readonly merchant: string; readonly timestamp: string }
  | { readonly error: string } {
  const bankMatch = payload.match(
    /used at\s+(.+?)\s+on\s+([0-9]{4}-[0-9]{2}-[0-9]{2}(?:[ T][0-9]{2}:[0-9]{2}(?::[0-9]{2})?)?)\s+for\s+(?:INR|RS\.?|Rs\.?)\s*([0-9]+(?:\.[0-9]{1,2})?)/i
  );

  if (!bankMatch) {
    return { error: "bank alert missing merchant, timestamp, or amount fields" };
  }

  const merchant = bankMatch[1]?.trim();
  const amount = Number.parseFloat(bankMatch[3] ?? "NaN");
  const timestamp = normalizeAlertTimestamp(bankMatch[2]);

  if (!merchant) {
    return { error: "bank alert merchant was empty" };
  }

  if (!Number.isFinite(amount)) {
    return { error: "bank alert amount was not a valid number" };
  }

  if (!timestamp) {
    return { error: "bank alert timestamp was not parseable" };
  }

  return { amount, merchant, timestamp };
}

function parseFastagAlert(payload: string):
  | { readonly amount: number; readonly merchant: string; readonly timestamp: string }
  | { readonly error: string } {
  const fastagMatch = payload.match(
    /FASTag(?:\s+Debit)?\s*:\s*(?:Toll Plaza\s+)?(.+?)\s+charged\s+(?:INR|RS\.?|Rs\.?)\s*([0-9]+(?:\.[0-9]{1,2})?)\s+(?:at|on)\s+([0-9A-Za-z:\-\sTZ]+)/i
  );

  if (!fastagMatch) {
    return { error: "FASTag alert missing toll plaza, timestamp, or amount fields" };
  }

  const merchant = fastagMatch[1]?.trim();
  const amount = Number.parseFloat(fastagMatch[2] ?? "NaN");
  const timestamp = normalizeAlertTimestamp(fastagMatch[3]);

  if (!merchant) {
    return { error: "FASTag alert merchant was empty" };
  }

  if (!Number.isFinite(amount)) {
    return { error: "FASTag alert amount was not a valid number" };
  }

  if (!timestamp) {
    return { error: "FASTag alert timestamp was not parseable" };
  }

  return {
    amount,
    merchant: `Toll Plaza ${merchant}`,
    timestamp
  };
}

function parseImportedExpensePayload(payload: string):
  | { readonly amount: number; readonly merchant: string; readonly timestamp: string }
  | { readonly error: string } {
  const trimmedPayload = payload.trim();

  if (!trimmedPayload) {
    return { error: "payload was empty" };
  }

  if (/FASTag/i.test(trimmedPayload)) {
    return parseFastagAlert(trimmedPayload);
  }

  return parseBankAlert(trimmedPayload);
}

export function resetCurrentTripStoreForTests(): void {
  state = buildInitialState();
  notifySubscribers();
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

export function getPackingLists(): readonly PackingList[] {
  const tripId = getActiveTripId();
  return (state.packingListsByTrip[tripId] ?? []).map(clonePackingList);
}

export function getLedgerEntries(): readonly LedgerEntry[] {
  const tripId = getActiveTripId();
  return (state.ledgerEntriesByTrip[tripId] ?? []).map(cloneLedgerEntry);
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

  if ("error" in parsed) {
    const failedLog: FailedExpenseIngestionLog = {
      id: nextId("expense-failed"),
      tripId,
      source: input.source,
      rawPayload: input.payload,
      reason: parsed.error,
      createdAt: nextTimestamp()
    };

    state.failedLogsByTrip[tripId] = [...(state.failedLogsByTrip[tripId] ?? []), failedLog];
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
    source: input.source
  };

  state.ledgerEntriesByTrip[tripId] = [...(state.ledgerEntriesByTrip[tripId] ?? []), importedExpense];
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
