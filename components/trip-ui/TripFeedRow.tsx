import { Pressable, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

type TripFeedRowProps = {
  readonly title: string;
  readonly meta: string;
  readonly categoryLabel: string;
  readonly amountLabel: string;
  readonly onPress?: () => void;
};

export function TripFeedRow({ title, meta, categoryLabel, amountLabel, onPress }: TripFeedRowProps) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const content = (
    <View className="rounded-[26px] bg-white/95 px-4 py-3 shadow-sm">
      <View className="flex-row items-center justify-between">
        <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-[#123f33]">
          <Text className="text-sm font-semibold text-white">{initials || "₹"}</Text>
        </View>
        <View className="mr-3 flex-1">
          <Text className="text-base font-semibold text-[#07110d]">{title}</Text>
          <Text className="mt-0.5 text-xs text-zinc-500">{meta}</Text>
          <View className="mt-1 self-start rounded-full bg-[#eef4f1] px-2.5 py-1">
            <Text className="text-[11px] font-semibold uppercase text-zinc-600">{categoryLabel}</Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-base font-semibold text-[#07110d]">{amountLabel}</Text>
          {onPress ? <FontAwesome6 name="chevron-right" size={12} color="#9ca3af" /> : null}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return (
    content
  );
}
