import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";

type TripBottomSheetProps = {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
};

export function TripBottomSheet({ visible, title, onClose, children }: TripBottomSheetProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/35">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="rounded-t-3xl bg-white px-5 pb-7 pt-5">
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-zinc-300" />
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-zinc-900">{title}</Text>
            <Pressable onPress={onClose} className="rounded-full bg-zinc-100 px-3 py-1.5">
              <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Close</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
