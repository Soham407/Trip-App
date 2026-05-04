import type { ReactNode } from "react";
import { View } from "react-native";

type TripCardProps = {
  readonly children: ReactNode;
};

export function TripCard({ children }: TripCardProps) {
  return <View className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">{children}</View>;
}
