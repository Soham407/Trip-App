import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

type TripScreenShellProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly actionSlot?: ReactNode;
  readonly backIcon?: boolean;
  readonly children: ReactNode;
};

export function TripScreenShell({ title, subtitle, actionSlot, backIcon = false, children }: TripScreenShellProps) {
  return (
    <View className="w-full max-w-[430px] flex-1 self-center bg-[#eef4f1] px-5 pt-6">
      <View className="flex-row items-center justify-between">
        <Pressable className="h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-sm">
          <FontAwesome6 name={backIcon ? "chevron-left" : "bars-staggered"} size={17} color="#07110d" />
        </Pressable>
        <View className="flex-1 px-4">
          <Text className="text-center text-xl font-semibold text-[#07110d]">{title}</Text>
          {subtitle ? <Text className="mt-1 text-center text-xs text-zinc-500">{subtitle}</Text> : null}
        </View>
        {actionSlot ? (
          <View>{actionSlot}</View>
        ) : (
          <Pressable className="h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-sm">
            <FontAwesome6 name="ellipsis" size={17} color="#07110d" />
          </Pressable>
        )}
      </View>
      <View className="mt-6 flex-1">{children}</View>
    </View>
  );
}
