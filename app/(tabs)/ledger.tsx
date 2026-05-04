import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  categorizeImportedExpense,
  getCurrentTrip,
  getFailedExpenseIngestionLog,
  getLedgerEntries,
  getNeedsReviewExpenses,
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
  resolveCategoryLabel
} from "@/components/trip-ui";

export default function LedgerScreen() {
  const [, setStoreRevision] = useState(0);
  useEffect(() => subscribeCurrentTripStore(() => setStoreRevision((value) => value + 1)), []);

  const trip = getCurrentTrip();
  const tripMemberId = getTripMembers(trip.id)[0]?.id;
  const entries = getLedgerEntries();
  const failedLog = getFailedExpenseIngestionLog();
  const needsReviewRows = buildLedgerFeedRows(getNeedsReviewExpenses(), trip.currency);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [reviewSheetExpenseId, setReviewSheetExpenseId] = useState<string>();
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>();
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>();

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
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
  }, [entries, selectedParentId, selectedSubcategoryId]);

  const rows = buildLedgerFeedRows(filteredEntries, trip.currency);
  const selectedReviewExpense = entries.find((entry) => entry.id === reviewSheetExpenseId);
  const selectedLabel = resolveCategoryLabel(selectedParentId, selectedSubcategoryId);

  return (
    <TripScreenShell title="Ledger" subtitle="Shared spending for the current trip">
      <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Needs review ({needsReviewRows.length})
          </Text>
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

        <View className="flex-row items-center justify-between rounded-2xl border border-amber-100 bg-white p-3">
          <View className="flex-row items-center gap-2">
            <TripChip label={selectedParentId ? selectedLabel : "All categories"} selected={!!selectedParentId} />
          </View>
          <Pressable
            onPress={() => setCategorySheetOpen(true)}
            className="rounded-full border border-teal-600 bg-teal-50 px-4 py-2"
          >
            <Text className="text-xs font-semibold uppercase tracking-wide text-teal-700">Pick category</Text>
          </Pressable>
        </View>

        <View className="gap-2">
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

        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Failed imports ({failedLog.length})
          </Text>
          {failedLog.length ? (
            failedLog.map((log) => (
              <View key={log.id} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <Text className="text-xs font-semibold uppercase tracking-wide text-rose-700">Reason</Text>
                <Text className="mt-1 text-sm text-rose-900">{log.reason}</Text>
                <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-rose-700">Raw payload</Text>
                <Text className="mt-1 text-sm text-rose-900">{log.rawPayload}</Text>
              </View>
            ))
          ) : (
            <View className="rounded-2xl border border-amber-100 bg-white px-4 py-3">
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

          categorizeImportedExpense({
            expenseId: reviewSheetExpenseId,
            actingTripMemberId: tripMemberId,
            categoryParentId,
            categorySubcategoryId
          });
          setReviewSheetExpenseId(undefined);
        }}
        onUncategorize={() => {
          if (!reviewSheetExpenseId || !tripMemberId) {
            return;
          }

          uncategorizeImportedExpense({
            expenseId: reviewSheetExpenseId,
            actingTripMemberId: tripMemberId
          });
          setReviewSheetExpenseId(undefined);
        }}
      />
    </TripScreenShell>
  );
}
