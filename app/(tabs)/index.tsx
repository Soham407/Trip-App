import { Text, View } from "react-native";

import { getCurrentTrip, getDashboardSnapshot } from "@/data/currentTripStore";

export default function DashboardScreen() {
  const trip = getCurrentTrip();
  const dashboard = getDashboardSnapshot();

  return (
    <View className="flex-1 bg-stone-100 px-5 py-6">
      <Text className="text-3xl font-bold text-stone-900">Dashboard</Text>
      <Text className="mt-2 text-base text-stone-700">
        {trip.destination} ({trip.startsOn} to {trip.endsOn})
      </Text>
      <View className="mt-6 rounded-xl bg-white p-4">
        <Text className="text-xs uppercase tracking-wide text-stone-500">Current Trip</Text>
        <Text className="mt-2 text-lg font-semibold text-stone-900">{dashboard.title}</Text>
        <Text className="mt-1 text-sm text-stone-600">
          Checklist progress: {Math.round(dashboard.checklistProgress * 100)}%
        </Text>
      </View>
    </View>
  );
}
