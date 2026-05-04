import type { ReactNode } from "react";
import { Text, View } from "react-native";

type TripScreenShellProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly actionSlot?: ReactNode;
  readonly children: ReactNode;
};

export function TripScreenShell({ title, subtitle, actionSlot, children }: TripScreenShellProps) {
  return (
    <View className="flex-1 bg-amber-50 px-5 pt-6">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-3xl font-bold tracking-tight text-zinc-900">{title}</Text>
          {subtitle ? <Text className="mt-1 text-sm text-zinc-600">{subtitle}</Text> : null}
        </View>
        {actionSlot ? <View className="pt-1">{actionSlot}</View> : null}
      </View>
      <View className="mt-5 flex-1">{children}</View>
    </View>
  );
}
