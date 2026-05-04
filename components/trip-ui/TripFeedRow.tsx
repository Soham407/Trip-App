import { Text, View } from "react-native";

type TripFeedRowProps = {
  readonly title: string;
  readonly meta: string;
  readonly categoryLabel: string;
  readonly amountLabel: string;
};

export function TripFeedRow({ title, meta, categoryLabel, amountLabel }: TripFeedRowProps) {
  return (
    <View className="rounded-2xl border border-amber-100 bg-white px-4 py-3 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-base font-semibold text-zinc-900">{title}</Text>
          <Text className="mt-0.5 text-xs uppercase tracking-wide text-zinc-500">{categoryLabel}</Text>
          <Text className="mt-1 text-sm text-zinc-600">{meta}</Text>
        </View>
        <Text className="text-base font-semibold text-zinc-900">{amountLabel}</Text>
      </View>
    </View>
  );
}
