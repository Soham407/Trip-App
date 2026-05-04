import { ScrollView, Text, View } from "react-native";

import { getCurrentTrip, getDashboardSnapshot, getLedgerEntries } from "@/data/currentTripStore";
import { TripCard, TripFeedRow, TripScreenShell, buildLedgerFeedRows } from "@/components/trip-ui";

export default function DashboardScreen() {
  const trip = getCurrentTrip();
  const dashboard = getDashboardSnapshot();
  const recentRows = buildLedgerFeedRows(getLedgerEntries(), trip.currency).slice(0, 2);

  return (
    <TripScreenShell
      title="Dashboard"
      subtitle={`${trip.destination} • ${trip.startsOn} to ${trip.endsOn}`}
    >
      <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
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
    </TripScreenShell>
  );
}
