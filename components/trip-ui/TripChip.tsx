import { Pressable, Text } from "react-native";

type TripChipProps = {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress?: () => void;
};

export function TripChip({ label, selected = false, onPress }: TripChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={
        selected
          ? "rounded-full border border-teal-600 bg-teal-600 px-4 py-2"
          : "rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2"
      }
    >
      <Text className={selected ? "text-xs font-semibold text-white" : "text-xs font-semibold text-zinc-700"}>
        {label}
      </Text>
    </Pressable>
  );
}
