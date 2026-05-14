import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

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
  buildLedgerFeedRows,
  formatTripCurrency
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
  const totalSpend = ledgerEntries
    .filter((entry) => !entry.deletedAt)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const pendingSpend = ledgerEntries
    .filter((entry) => entry.syncStatus === "pending")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const selectedExpense = useMemo(
    () => ledgerEntries.find((entry) => entry.id === selectedExpenseId),
    [ledgerEntries, selectedExpenseId]
  );

  return (
    <TripScreenShell
      title="My Trip"
      subtitle={`${trip.destination} • ${trip.startsOn} to ${trip.endsOn}`}
      actionSlot={
        <Pressable className="h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-sm">
          <FontAwesome6 name="bell" size={18} color="#07110d" />
          {dashboard.needsReviewCount ? (
            <View className="absolute right-1 top-0 rounded-full bg-[#caff68] px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-[#07110d]">{dashboard.needsReviewCount}</Text>
            </View>
          ) : null}
        </Pressable>
      }
    >
      <ScrollView className="flex-1" contentContainerClassName="gap-5 pb-28">
        <TripCard className="items-center bg-[#f7fbf8] py-7">
          <View className="rounded-full bg-white px-4 py-2 shadow-sm">
            <Text className="text-xs font-semibold text-zinc-500">{dashboard.title}</Text>
          </View>
          <Text className="mt-5 text-sm text-zinc-500">Trip spending</Text>
          <Text className="mt-1 text-[42px] font-bold tracking-tight text-[#07110d]">
            {formatTripCurrency(trip.currency, totalSpend)}
          </Text>
          <View className="mt-3 rounded-full bg-[#eef4f1] px-4 py-2">
            <Text className="text-xs font-semibold text-[#5f64b7]">
              Checklist {Math.round(dashboard.checklistProgress * 100)}% complete
            </Text>
          </View>
        </TripCard>

        <View className="flex-row justify-between rounded-[30px] bg-[#eef4f1] p-3">
          {[
            { icon: "receipt", label: "Review" },
            { icon: "list-check", label: "Lists" },
            { icon: "wallet", label: "Cash" },
            { icon: "ellipsis", label: "More" }
          ].map((item, index) => (
            <View key={item.label} className="items-center gap-2">
              <View
                className={
                  index === 0
                    ? "h-14 w-14 items-center justify-center rounded-full bg-[#caff68]"
                    : "h-14 w-14 items-center justify-center rounded-full bg-white"
                }
              >
                <FontAwesome6 name={item.icon} size={18} color="#07110d" />
              </View>
              <Text className="text-xs font-medium text-[#07110d]">{item.label}</Text>
            </View>
          ))}
        </View>

        <View className="flex-row gap-3">
          <TripCard className="flex-1">
            <Text className="text-xs font-semibold text-zinc-500">Pending sync</Text>
            <Text className="mt-2 text-xl font-bold text-[#07110d]">
              {formatTripCurrency(trip.currency, pendingSpend)}
            </Text>
          </TripCard>
          <TripCard className="flex-1">
            <Text className="text-xs font-semibold text-zinc-500">Ledger entries</Text>
            <Text className="mt-2 text-xl font-bold text-[#07110d]">{dashboard.entryCount}</Text>
          </TripCard>
        </View>

        {needsReviewRows.length ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-xl font-semibold text-[#07110d]">Needs Review</Text>
              <Text className="text-sm font-medium text-zinc-500">{dashboard.needsReviewCount} items</Text>
            </View>
            {needsReviewRows.map((row) => (
              <TripFeedRow
                key={row.id}
                title={row.title}
                meta={row.meta}
                amountLabel={row.amountLabel}
                categoryLabel={row.categoryLabel}
                onPress={() => setSelectedExpenseId(row.id)}
              />
            ))}
          </View>
        ) : null}

        <View className="gap-2">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-xl font-semibold text-[#07110d]">Transaction History</Text>
            <Text className="text-sm font-medium text-[#07110d]">View all</Text>
          </View>
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
