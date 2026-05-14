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
          ? "rounded-full border border-[#caff68] bg-[#caff68] px-5 py-2.5 shadow-sm"
          : "rounded-full border border-zinc-200 bg-white/85 px-5 py-2.5"
      }
    >
      <Text className={selected ? "text-sm font-semibold text-[#07110d]" : "text-sm font-medium text-zinc-700"}>
        {label}
      </Text>
    </Pressable>
  );
}
