import type { ReactNode } from "react";
import { View } from "react-native";

type TripCardProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

export function TripCard({ children, className = "" }: TripCardProps) {
  return (
    <View className={`rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-sm ${className}`}>
      {children}
    </View>
  );
}
