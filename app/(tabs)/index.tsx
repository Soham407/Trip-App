import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  categorizeImportedExpense,
  getCurrentTrip,
  getDashboardSnapshot,
  getLedgerEntries,
  getNeedsReviewExpenses,
  subscribeCurrentTripStore,
  uncategorizeImportedExpense
} from "@/data/currentTripStore";
import { getTripMembers } from "@/data/tripIdentityStore";
import {
  TripCard,
  TripExpenseReviewSheet,
  TripFeedRow,
  TripScreenShell,
  buildLedgerFeedRows
} from "@/components/trip-ui";

export default function DashboardScreen() {
  const [, setStoreRevision] = useState(0);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>();

  useEffect(() => subscribeCurrentTripStore(() => setStoreRevision((value) => value + 1)), []);

  const trip = getCurrentTrip();
  const tripMemberId = getTripMembers(trip.id)[0]?.id;
  const dashboard = getDashboardSnapshot();
  const ledgerEntries = getLedgerEntries();
  const needsReviewRows = buildLedgerFeedRows(getNeedsReviewExpenses(), trip.currency);
  const recentRows = buildLedgerFeedRows(ledgerEntries, trip.currency).slice(0, 2);
  const selectedExpense = useMemo(
    () => ledgerEntries.find((entry) => entry.id === selectedExpenseId),
    [ledgerEntries, selectedExpenseId]
  );

  return (
    <TripScreenShell
      title="Dashboard"
      subtitle={`${trip.destination} • ${trip.startsOn} to ${trip.endsOn}`}
    >
      <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Needs review ({dashboard.needsReviewCount})
          </Text>
          {needsReviewRows.length ? (
            needsReviewRows.map((row) => (
              <TripFeedRow
                key={row.id}
                title={row.title}
                meta={row.meta}
                amountLabel={row.amountLabel}
                categoryLabel={row.categoryLabel}
                onPress={() => setSelectedExpenseId(row.id)}
              />
            ))
          ) : (
            <TripCard>
              <Text className="text-sm text-zinc-600">No uncategorized imported expenses.</Text>
            </TripCard>
          )}
        </View>

        <TripCard>
          <Text className="text-xs uppercase tracking-wide text-zinc-500">Current trip</Text>
          <Text className="mt-2 text-lg font-semibold text-zinc-900">{dashboard.title}</Text>
          <Text className="mt-1 text-sm text-zinc-600">
            Checklist progress: {Math.round(dashboard.checklistProgress * 100)}%
          </Text>
          <Text className="mt-1 text-sm text-zinc-600">Ledger entries: {dashboard.entryCount}</Text>
        </TripCard>

        <View className="gap-2">
          <Text className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Recent activity
          </Text>
          {recentRows.map((row) => (
            <TripFeedRow
              key={row.id}
              title={row.title}
              meta={row.meta}
              amountLabel={row.amountLabel}
              categoryLabel={row.categoryLabel}
            />
          ))}
        </View>
      </ScrollView>

      <TripExpenseReviewSheet
        visible={!!selectedExpense}
        expense={selectedExpense}
        onClose={() => setSelectedExpenseId(undefined)}
        onCategorize={({ categoryParentId, categorySubcategoryId }) => {
          if (!selectedExpenseId || !tripMemberId) {
            return;
          }

          categorizeImportedExpense({
            expenseId: selectedExpenseId,
            actingTripMemberId: tripMemberId,
            categoryParentId,
            categorySubcategoryId
          });
          setSelectedExpenseId(undefined);
        }}
        onUncategorize={() => {
          if (!selectedExpenseId || !tripMemberId) {
            return;
          }

          uncategorizeImportedExpense({
            expenseId: selectedExpenseId,
            actingTripMemberId: tripMemberId
          });
          setSelectedExpenseId(undefined);
        }}
      />
    </TripScreenShell>
  );
}
