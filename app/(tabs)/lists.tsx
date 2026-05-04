import { Text, View } from "react-native";

import { getPackingLists } from "@/data/currentTripStore";

export default function ListsScreen() {
  const lists = getPackingLists();

  return (
    <View className="flex-1 bg-stone-100 px-5 py-6">
      <Text className="text-3xl font-bold text-stone-900">Lists</Text>
      <View className="mt-5 gap-3">
        {lists.map((list) => {
          const packedCount = list.items.filter((item) => item.packed).length;
          const totalCount = list.items.length;

          return (
            <View key={list.id} className="rounded-xl bg-white p-4">
              <Text className="text-base font-semibold text-stone-900">{list.title}</Text>
              <Text className="mt-1 text-sm text-stone-600">
                Packed {packedCount}/{totalCount}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
