import { Text, View } from "react-native";

import { getCurrentTrip, getLedgerEntries } from "@/data/currentTripStore";

export default function LedgerScreen() {
  const trip = getCurrentTrip();
  const entries = getLedgerEntries();

  return (
    <View className="flex-1 bg-stone-100 px-5 py-6">
      <Text className="text-3xl font-bold text-stone-900">Ledger</Text>
      <View className="mt-5 gap-3">
        {entries.map((entry) => (
          <View key={entry.id} className="rounded-xl bg-white p-4">
            <Text className="text-base font-semibold text-stone-900">{entry.label}</Text>
            <Text className="mt-1 text-sm text-stone-600">
              {trip.currency} {entry.amount.toFixed(2)}
            </Text>
            <Text className="mt-0.5 text-sm text-stone-500">Paid by {entry.paidBy}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
