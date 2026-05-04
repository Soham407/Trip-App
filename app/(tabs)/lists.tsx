import { ScrollView, Text, View } from "react-native";

import { getPackingLists } from "@/data/currentTripStore";
import { TripCard, TripChip, TripScreenShell } from "@/components/trip-ui";

export default function ListsScreen() {
  const lists = getPackingLists();

  return (
    <TripScreenShell title="Lists" subtitle="Family trip checklists">
      <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
        {lists.map((list) => {
          const packedCount = list.items.filter((item) => item.packed).length;
          const totalCount = list.items.length;
          const allPacked = packedCount === totalCount;

          return (
            <TripCard key={list.id}>
              <Text className="text-base font-semibold text-zinc-900">{list.title}</Text>
              <Text className="mt-1 text-sm text-zinc-600">
                Packed {packedCount}/{totalCount}
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {list.items.map((item) => (
                  <TripChip key={item.id} label={item.label} selected={item.packed} />
                ))}
              </View>
              <View className="mt-3 self-start">
                <TripChip label={allPacked ? "Ready to go" : "Needs packing"} selected={allPacked} />
              </View>
            </TripCard>
          );
        })}
      </ScrollView>
    </TripScreenShell>
  );
}
