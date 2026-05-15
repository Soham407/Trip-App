import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import {
  addTripCustomCategory,
  addManualCashLedgerEntry,
  buildImportedExpenseDraft,
  commitImportedExpenseDraft,
  categorizeImportedExpense,
  confirmLedgerEntryEditLock,
  getCurrentTrip,
  getFailedExpenseIngestionLog,
  getLedgerActivityHistory,
  getLedgerEntries,
  getNeedsReviewExpenses,
  getTripCustomCategories,
  hardDeleteLedgerEntry,
  ingestSharedExpenseAlert,
  requestLedgerEntryEditLock,
  retryPendingCloudSync,
  softDeleteLedgerEntry,
  subscribeCurrentTripStore,
  type ImportedExpenseDraft,
  updateManualCashLedgerEntry,
  uncategorizeImportedExpense
} from "@/data/currentTripStore";
import {
  getCurrentUserTripMember,
  getPrimaryAdminTripMember,
  getTripMembers
} from "@/data/tripIdentityStore";
import {
  TripCategorySheet,
  TripChip,
    TripExpenseReviewSheet,
    TripFeedRow,
    TripScreenShell,
    buildLedgerFeedRows,
    buildTripCategories,
    formatTripCurrency,
    resolveCategoryLabel
  } from "@/components/trip-ui";

export default function LedgerScreen() {
  const [, setStoreRevision] = useState(0);
  useEffect(() => subscribeCurrentTripStore(() => setStoreRevision((value) => value + 1)), []);

  const trip = getCurrentTrip();
  const tripMembers = getTripMembers(trip.id);
  const currentTripMember = getCurrentUserTripMember(trip.id);
  const tripMemberId = currentTripMember?.id;
  const entries = getLedgerEntries();
  const failedLog = getFailedExpenseIngestionLog();
  const categories = buildTripCategories(getTripCustomCategories());
  const needsReviewRows = buildLedgerFeedRows(getNeedsReviewExpenses(), trip.currency, categories);
  const activityHistory = tripMemberId ? getLedgerActivityHistory({ actingTripMemberId: tripMemberId }) : [];

  const [manualLabel, setManualLabel] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualPaidBy, setManualPaidBy] = useState(currentTripMember?.displayName ?? tripMembers[0]?.displayName ?? "");
  const [editingManualEntryId, setEditingManualEntryId] = useState<string>();
  const [editingManualEntryLockId, setEditingManualEntryLockId] = useState<string>();
  const [importPayload, setImportPayload] = useState("");
  const [importDraft, setImportDraft] = useState<ImportedExpenseDraft>();
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

  const rows = buildLedgerFeedRows(filteredEntries, trip.currency, categories);
  const selectedReviewExpense = entries.find((entry) => entry.id === reviewSheetExpenseId);
  const draftReviewExpense = importDraft ? {
    id: importDraft.id,
    tripId: importDraft.tripId,
    label: importDraft.label,
    amount: importDraft.amount,
    paidBy: "Imported alert",
    createdAt: importDraft.createdAt,
    status: "imported-uncategorized" as const,
    source: importDraft.source,
    syncStatus: "pending" as const
  } : undefined;
  const editingManualEntry = entries.find((entry) => entry.id === editingManualEntryId);
  const selectedLabel = resolveCategoryLabel(selectedParentId, selectedSubcategoryId, categories);
  const primaryAdminMemberId = getPrimaryAdminTripMember(trip.id)?.id;
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

  useEffect(() => {
    if (!editingManualEntry) {
      return;
    }

    setManualLabel(editingManualEntry.label);
    setManualAmount(String(editingManualEntry.amount));
    setManualPaidBy(editingManualEntry.paidBy);
  }, [editingManualEntry]);

  function resetManualForm() {
    setEditingManualEntryId(undefined);
    setEditingManualEntryLockId(undefined);
    setManualLabel("");
    setManualAmount("");
    setManualPaidBy(currentTripMember?.displayName ?? tripMembers[0]?.displayName ?? "");
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
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {editingManualEntryId ? "Edit manual cash entry" : "Manual cash entry"}
            </Text>
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
          <View className="mt-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Paid by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mt-2 gap-2 pr-5">
              {tripMembers.map((member) => (
                <TripChip
                  key={member.id}
                  label={member.displayName}
                  selected={manualPaidBy === member.displayName}
                  onPress={() => setManualPaidBy(member.displayName)}
                />
              ))}
            </ScrollView>
          </View>
          <Pressable
            onPress={() => {
              if (!tripMemberId) {
                return;
              }

              const amount = Number.parseFloat(manualAmount);

              try {
                if (editingManualEntryId && editingManualEntryLockId) {
                  updateManualCashLedgerEntry({
                    ledgerEntryId: editingManualEntryId,
                    label: manualLabel,
                    amount,
                    paidBy: manualPaidBy,
                    actingTripMemberId: tripMemberId
                  });
                  confirmLedgerEntryEditLock({
                    ledgerEntryId: editingManualEntryId,
                    actingTripMemberId: tripMemberId,
                    lockId: editingManualEntryLockId
                  });
                  resetManualForm();
                  setEntryMessage("Manual cash entry updated.");
                } else {
                  addManualCashLedgerEntry({
                    label: manualLabel,
                    amount,
                    paidBy: manualPaidBy,
                    actingTripMemberId: tripMemberId
                  });
                  resetManualForm();
                  setEntryMessage("Cash entry saved as pending sync.");
                }
              } catch (error) {
                setEntryMessage(error instanceof Error ? error.message : "Unable to add manual cash entry.");
              }
            }}
            className="mt-3 rounded-full bg-[#caff68] px-4 py-3"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">
              {editingManualEntryId ? "Save changes" : "Add cash entry"}
            </Text>
          </Pressable>
          {editingManualEntryId ? (
            <Pressable
              onPress={() => {
                if (editingManualEntryId && editingManualEntryLockId && tripMemberId) {
                  confirmLedgerEntryEditLock({
                    ledgerEntryId: editingManualEntryId,
                    actingTripMemberId: tripMemberId,
                    lockId: editingManualEntryLockId
                  });
                }
                resetManualForm();
              }}
              className="mt-2 rounded-full border border-zinc-200 bg-white px-4 py-3"
            >
              <Text className="text-center text-sm font-semibold text-[#07110d]">Cancel edit</Text>
            </Pressable>
          ) : null}
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

                const preview = buildImportedExpenseDraft({
                  source: "email",
                  payload: importPayload
                });

                if (preview.status === "failed") {
                  const imported = ingestSharedExpenseAlert({
                    source: "email",
                    payload: importPayload
                  });

                  setImportDraft(undefined);
                  setImportMessage(imported ? "Imported alert added to needs review." : "Alert moved to failed imports.");
                  return;
                }

                setImportDraft(preview.draft);
                setImportMessage("Review the locked import details before committing the expense.");
              }}
              className="rounded-full bg-[#caff68] px-4 py-3"
            >
              <Text className="text-sm font-semibold text-[#07110d]">Review import</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setImportPayload("");
                setImportDraft(undefined);
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

                    retryPendingCloudSync();
                    setEntryMessage(`Retried sync for ${entry.label}.`);
                  }}
                  className="rounded-2xl bg-[#eef4f1] px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-[#07110d]">Retry sync: {entry.label}</Text>
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
          {filteredEntries.map((entry) => {
            const row = buildLedgerFeedRows([entry], trip.currency, categories)[0];

            if (!row) {
              return null;
            }

            const canEditManual = entry.source === "manual" && entry.isCash && !entry.deletedAt;
            const canHardDelete = !!entry.deletedAt && tripMemberId === primaryAdminMemberId;

            return (
              <View key={entry.id} className="gap-2">
                <TripFeedRow
                  title={row.title}
                  meta={row.meta}
                  amountLabel={row.amountLabel}
                  categoryLabel={row.categoryLabel}
                />
                {canEditManual ? (
                  <View className="flex-row gap-2 px-2">
                    <Pressable
                      onPress={() => {
                        const lockId = reserveSharedEditLock(entry.id);

                        if (!lockId) {
                          return;
                        }

                        setEditingManualEntryId(entry.id);
                        setEditingManualEntryLockId(lockId);
                        setEntryMessage(`Editing ${entry.label}.`);
                      }}
                      className="rounded-full border border-zinc-200 bg-white px-4 py-2"
                    >
                      <Text className="text-xs font-semibold uppercase tracking-wide text-[#07110d]">Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (!tripMemberId) {
                          return;
                        }

                        softDeleteLedgerEntry({
                          ledgerEntryId: entry.id,
                          actingTripMemberId: tripMemberId
                        });
                        if (editingManualEntryId === entry.id) {
                          resetManualForm();
                        }
                        setEntryMessage(`Deleted ${entry.label}.`);
                      }}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2"
                    >
                      <Text className="text-xs font-semibold uppercase tracking-wide text-rose-700">Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
                {canHardDelete ? (
                  <View className="px-2">
                    <Pressable
                      onPress={() => {
                        if (!tripMemberId) {
                          return;
                        }

                        hardDeleteLedgerEntry({
                          ledgerEntryId: entry.id,
                          actingTripMemberId: tripMemberId
                        });
                        setEntryMessage(`Permanently removed ${entry.label}.`);
                      }}
                      className="self-start rounded-full border border-rose-300 bg-white px-4 py-2"
                    >
                      <Text className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                        Hard delete
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
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
        categories={categories}
        parentId={selectedParentId}
        subcategoryId={selectedSubcategoryId}
        onClose={() => setCategorySheetOpen(false)}
        onApply={({ parentId, subcategoryId }) => {
          setSelectedParentId(parentId);
          setSelectedSubcategoryId(subcategoryId);
          setCategorySheetOpen(false);
        }}
        onCreateCategory={({ label, parentCategoryId }) => {
          const category = addTripCustomCategory({ label, parentCategoryId });
          if (parentCategoryId) {
            setSelectedParentId(parentCategoryId);
            setSelectedSubcategoryId(category.id);
          } else {
            setSelectedParentId(category.id);
            setSelectedSubcategoryId(undefined);
          }
          setCategorySheetOpen(false);
        }}
      />

      <TripExpenseReviewSheet
        visible={!!draftReviewExpense}
        title="Review imported expense before save"
        primaryActionLabel="Import categorized"
        secondaryActionLabel="Add uncategorized"
        categories={categories}
        expense={draftReviewExpense}
        onClose={() => setImportDraft(undefined)}
        onCategorize={({ categoryParentId, categorySubcategoryId }) => {
          if (!importDraft || !tripMemberId) {
            return;
          }

          commitImportedExpenseDraft({
            draft: importDraft,
            actingTripMemberId: tripMemberId,
            categoryParentId,
            categorySubcategoryId
          });
          setImportDraft(undefined);
          setImportPayload("");
          setImportMessage("Imported alert saved.");
        }}
        onUncategorize={() => {
          if (!importDraft || !tripMemberId) {
            return;
          }

          commitImportedExpenseDraft({
            draft: importDraft,
            actingTripMemberId: tripMemberId
          });
          setImportDraft(undefined);
          setImportPayload("");
          setImportMessage("Imported alert added to needs review.");
        }}
        onCreateCategory={({ label, parentCategoryId }) => {
          const category = addTripCustomCategory({ label, parentCategoryId });
          if (parentCategoryId) {
            setSelectedParentId(parentCategoryId);
            setSelectedSubcategoryId(category.id);
          } else {
            setSelectedParentId(category.id);
            setSelectedSubcategoryId(undefined);
          }
        }}
      />

      <TripExpenseReviewSheet
        visible={!!selectedReviewExpense}
        categories={categories}
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
        onCreateCategory={({ label, parentCategoryId }) => {
          const category = addTripCustomCategory({ label, parentCategoryId });
          if (parentCategoryId) {
            setSelectedParentId(parentCategoryId);
            setSelectedSubcategoryId(category.id);
          } else {
            setSelectedParentId(category.id);
            setSelectedSubcategoryId(undefined);
          }
        }}
      />
    </TripScreenShell>
  );
}
