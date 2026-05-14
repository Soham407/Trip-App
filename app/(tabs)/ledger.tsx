import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import {
  addManualCashLedgerEntry,
  categorizeImportedExpense,
  confirmLedgerEntryEditLock,
  confirmManualLedgerEntrySync,
  getCurrentTrip,
  getFailedExpenseIngestionLog,
  getLedgerActivityHistory,
  getLedgerEntries,
  getNeedsReviewExpenses,
  ingestSharedExpenseAlert,
  requestLedgerEntryEditLock,
  subscribeCurrentTripStore,
  uncategorizeImportedExpense
} from "@/data/currentTripStore";
import { getTripMembers } from "@/data/tripIdentityStore";
import {
  TripCategorySheet,
  TripChip,
  TripExpenseReviewSheet,
  TripFeedRow,
  TripScreenShell,
  buildLedgerFeedRows,
  formatTripCurrency,
  resolveCategoryLabel
} from "@/components/trip-ui";

export default function LedgerScreen() {
  const [, setStoreRevision] = useState(0);
  useEffect(() => subscribeCurrentTripStore(() => setStoreRevision((value) => value + 1)), []);

  const trip = getCurrentTrip();
  const tripMembers = getTripMembers(trip.id);
  const tripMemberId = tripMembers[0]?.id;
  const entries = getLedgerEntries();
  const failedLog = getFailedExpenseIngestionLog();
  const needsReviewRows = buildLedgerFeedRows(getNeedsReviewExpenses(), trip.currency);
  const activityHistory = tripMemberId ? getLedgerActivityHistory({ actingTripMemberId: tripMemberId }) : [];

  const [manualLabel, setManualLabel] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualPaidBy, setManualPaidBy] = useState(tripMembers[0]?.displayName ?? "");
  const [importPayload, setImportPayload] = useState("");
  const [entryMessage, setEntryMessage] = useState<string>();
  const [importMessage, setImportMessage] = useState<string>();
  const [lockPrompt, setLockPrompt] = useState<string>();
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedQueue, setFocusedQueue] = useState<"all" | "needs-review" | "failed">("all");

  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [reviewSheetExpenseId, setReviewSheetExpenseId] = useState<string>();
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>();
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>();

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (focusedQueue === "needs-review" && entry.status !== "imported-uncategorized") {
        return false;
      }

      const normalizedQuery = searchQuery.trim().toLowerCase();

      if (
        normalizedQuery &&
        !`${entry.label} ${entry.paidBy} ${entry.categoryParentId ?? ""} ${entry.categorySubcategoryId ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }

      if (!selectedParentId) {
        return true;
      }

      if (entry.categoryParentId !== selectedParentId) {
        return false;
      }

      if (!selectedSubcategoryId) {
        return true;
      }

      return entry.categorySubcategoryId === selectedSubcategoryId;
    });
  }, [entries, focusedQueue, searchQuery, selectedParentId, selectedSubcategoryId]);

  const rows = buildLedgerFeedRows(filteredEntries, trip.currency);
  const selectedReviewExpense = entries.find((entry) => entry.id === reviewSheetExpenseId);
  const selectedLabel = resolveCategoryLabel(selectedParentId, selectedSubcategoryId);
  const pendingManualCashEntries = entries.filter(
    (entry) => entry.source === "manual" && entry.isCash && entry.syncStatus === "pending"
  );
  const totalSpend = filteredEntries
    .filter((entry) => !entry.deletedAt)
    .reduce((sum, entry) => sum + entry.amount, 0);

  function reserveSharedEditLock(ledgerEntryId: string): string | null {
    if (!tripMemberId) {
      return null;
    }

    const lock = requestLedgerEntryEditLock({
      ledgerEntryId,
      actingTripMemberId: tripMemberId
    });

    if (lock.status === "conflict") {
      setLockPrompt(`${lock.prompt} Lock expires at ${lock.expiresAt}.`);
      return null;
    }

    setLockPrompt(undefined);
    return lock.lockId;
  }

  return (
    <TripScreenShell
      title="Transaction History"
      subtitle={`${trip.destination} • ${formatTripCurrency(trip.currency, totalSpend)}`}
      backIcon
      actionSlot={
        <Pressable
          onPress={() => setSearchVisible((value) => !value)}
          className="h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-sm"
        >
          <FontAwesome6 name="magnifying-glass" size={18} color="#07110d" />
        </Pressable>
      }
    >
      <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-28">
        {searchVisible ? (
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            placeholder="Search merchant, payer, or category"
            className="rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm text-zinc-900"
          />
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-5">
          <TripChip label="All" selected={focusedQueue === "all" && !selectedParentId} onPress={() => {
            setFocusedQueue("all");
            setSelectedParentId(undefined);
            setSelectedSubcategoryId(undefined);
          }} />
          <TripChip label={selectedParentId ? selectedLabel : "Category"} selected={!!selectedParentId} onPress={() => setCategorySheetOpen(true)} />
          <TripChip label="Needs review" selected={focusedQueue === "needs-review"} onPress={() => setFocusedQueue("needs-review")} />
          <TripChip label="Failed" selected={focusedQueue === "failed"} onPress={() => setFocusedQueue("failed")} />
        </ScrollView>

        <View className="rounded-[28px] bg-white/95 p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Manual cash entry</Text>
            <View className="rounded-full bg-[#caff68] px-3 py-1">
              <Text className="text-xs font-semibold text-[#07110d]">Pending sync</Text>
            </View>
          </View>
          <TextInput
            value={manualLabel}
            onChangeText={setManualLabel}
            placeholder="What was paid"
            className="mt-3 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <TextInput
            value={manualAmount}
            onChangeText={setManualAmount}
            placeholder="Amount in ₹"
            keyboardType="decimal-pad"
            className="mt-2 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <TextInput
            value={manualPaidBy}
            onChangeText={setManualPaidBy}
            placeholder="Paid by"
            className="mt-2 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <Pressable
            onPress={() => {
              if (!tripMemberId) {
                return;
              }

              const amount = Number.parseFloat(manualAmount);

              try {
                addManualCashLedgerEntry({
                  label: manualLabel,
                  amount,
                  paidBy: manualPaidBy,
                  actingTripMemberId: tripMemberId
                });
                setManualLabel("");
                setManualAmount("");
                setEntryMessage("Cash entry saved as pending sync.");
              } catch (error) {
                setEntryMessage(error instanceof Error ? error.message : "Unable to add manual cash entry.");
              }
            }}
            className="mt-3 rounded-full bg-[#caff68] px-4 py-3"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">
              Add cash entry
            </Text>
          </Pressable>
          {!!entryMessage && <Text className="mt-2 text-xs text-zinc-600">{entryMessage}</Text>}
        </View>

        <View className="rounded-[28px] bg-white/95 p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Shared expense import</Text>
            <View className="rounded-full bg-[#eef4f1] px-3 py-1">
              <Text className="text-xs font-semibold text-[#07110d]">Review queue</Text>
            </View>
          </View>
          <TextInput
            value={importPayload}
            onChangeText={setImportPayload}
            placeholder="Paste bank or FASTag alert"
            multiline
            className="mt-3 min-h-24 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => {
                if (!importPayload.trim()) {
                  setImportMessage("Paste a real bank, GPay, UPI, or FASTag alert first.");
                  return;
                }

                const imported = ingestSharedExpenseAlert({
                  source: "email",
                  payload: importPayload
                });

                setImportMessage(imported ? "Imported alert added to needs review." : "Alert moved to failed imports.");
              }}
              className="rounded-full bg-[#caff68] px-4 py-3"
            >
              <Text className="text-sm font-semibold text-[#07110d]">Import alert</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setImportPayload("");
                setImportMessage(undefined);
              }}
              className="rounded-full border border-zinc-200 bg-white px-4 py-3"
            >
              <Text className="text-sm font-semibold text-[#07110d]">Clear</Text>
            </Pressable>
          </View>
          {!!importMessage && <Text className="mt-2 text-xs text-zinc-600">{importMessage}</Text>}
        </View>

        {pendingManualCashEntries.length ? (
          <View className="rounded-[28px] bg-white/95 p-4 shadow-sm">
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pending manual sync</Text>
            <View className="mt-3 gap-2">
              {pendingManualCashEntries.map((entry) => (
                <Pressable
                  key={entry.id}
                  onPress={() => {
                    if (!tripMemberId) {
                      return;
                    }

                    confirmManualLedgerEntrySync({
                      ledgerEntryId: entry.id,
                      actingTripMemberId: tripMemberId
                    });
                    setEntryMessage(`Confirmed sync for ${entry.label}.`);
                  }}
                  className="rounded-2xl bg-[#eef4f1] px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-[#07110d]">Confirm sync: {entry.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {!!lockPrompt && (
          <View className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3">
            <Text className="text-sm text-rose-900">{lockPrompt}</Text>
          </View>
        )}

        {focusedQueue !== "failed" ? (
        <View className="gap-2">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Needs review ({needsReviewRows.length})
            </Text>
            {needsReviewRows[0] && tripMembers[1] ? (
              <Pressable
                onPress={() => {
                  const conflictLock = requestLedgerEntryEditLock({
                    ledgerEntryId: needsReviewRows[0].id,
                    actingTripMemberId: tripMembers[1].id
                  });

                  if (conflictLock.status === "granted") {
                    setLockPrompt(`${tripMembers[1].displayName} is editing ${needsReviewRows[0].title}.`);
                  }
                }}
                className="rounded-full bg-white px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-[#07110d]">Simulate edit lock</Text>
              </Pressable>
            ) : null}
          </View>
          {needsReviewRows.map((row) => (
            <TripFeedRow
              key={row.id}
              title={row.title}
              meta={row.meta}
              amountLabel={row.amountLabel}
              categoryLabel={row.categoryLabel}
              onPress={() => setReviewSheetExpenseId(row.id)}
            />
          ))}
        </View>
        ) : null}

        {focusedQueue !== "failed" ? (
        <View className="gap-2">
          <Text className="px-1 text-sm font-semibold text-zinc-500">
            Today
          </Text>
          {rows.map((row) => (
            <TripFeedRow
              key={row.id}
              title={row.title}
              meta={row.meta}
              amountLabel={row.amountLabel}
              categoryLabel={row.categoryLabel}
            />
          ))}
        </View>
        ) : null}

        {focusedQueue !== "needs-review" ? (
        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Activity log ({activityHistory.length})
          </Text>
          {activityHistory.map((activity) => (
              <View key={activity.id} className="rounded-[24px] bg-white/90 px-4 py-3 shadow-sm">
              <Text className="text-sm font-medium text-zinc-900">{activity.message}</Text>
              <Text className="mt-1 text-xs text-zinc-500">{activity.createdAt}</Text>
            </View>
          ))}
        </View>
        ) : null}

        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Failed imports ({failedLog.length})
          </Text>
          {failedLog.length ? (
            failedLog.map((log) => (
                <View key={log.id} className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3">
                <Text className="text-xs font-semibold uppercase tracking-wide text-rose-700">Reason</Text>
                <Text className="mt-1 text-sm text-rose-900">{log.reason}</Text>
                <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-rose-700">Raw payload</Text>
                <Text className="mt-1 text-sm text-rose-900">{log.rawPayload}</Text>
              </View>
            ))
          ) : (
            <View className="rounded-[24px] bg-white/90 px-4 py-3">
              <Text className="text-sm text-zinc-600">No failed imports.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <TripCategorySheet
        visible={categorySheetOpen}
        parentId={selectedParentId}
        subcategoryId={selectedSubcategoryId}
        onClose={() => setCategorySheetOpen(false)}
        onApply={({ parentId, subcategoryId }) => {
          setSelectedParentId(parentId);
          setSelectedSubcategoryId(subcategoryId);
          setCategorySheetOpen(false);
        }}
      />

      <TripExpenseReviewSheet
        visible={!!selectedReviewExpense}
        expense={selectedReviewExpense}
        onClose={() => setReviewSheetExpenseId(undefined)}
        onCategorize={({ categoryParentId, categorySubcategoryId }) => {
          if (!reviewSheetExpenseId || !tripMemberId) {
            return;
          }

          const lockId = reserveSharedEditLock(reviewSheetExpenseId);

          if (!lockId) {
            return;
          }

          categorizeImportedExpense({
            expenseId: reviewSheetExpenseId,
            actingTripMemberId: tripMemberId,
            categoryParentId,
            categorySubcategoryId
          });
          confirmLedgerEntryEditLock({
            ledgerEntryId: reviewSheetExpenseId,
            actingTripMemberId: tripMemberId,
            lockId
          });
          setReviewSheetExpenseId(undefined);
        }}
        onUncategorize={() => {
          if (!reviewSheetExpenseId || !tripMemberId) {
            return;
          }

          const lockId = reserveSharedEditLock(reviewSheetExpenseId);

          if (!lockId) {
            return;
          }

          uncategorizeImportedExpense({
            expenseId: reviewSheetExpenseId,
            actingTripMemberId: tripMemberId
          });
          confirmLedgerEntryEditLock({
            ledgerEntryId: reviewSheetExpenseId,
            actingTripMemberId: tripMemberId,
            lockId
          });
          setReviewSheetExpenseId(undefined);
        }}
      />
    </TripScreenShell>
  );
}
