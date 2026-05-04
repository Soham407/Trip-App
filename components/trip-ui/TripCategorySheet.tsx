import { Pressable, Text, View } from "react-native";

import { TRIP_CATEGORIES, getSubcategoriesForParent } from "@/components/trip-ui/contracts";
import { TripBottomSheet } from "@/components/trip-ui/TripBottomSheet";
import { TripChip } from "@/components/trip-ui/TripChip";

type TripCategorySheetProps = {
  readonly visible: boolean;
  readonly parentId?: string;
  readonly subcategoryId?: string;
  readonly onClose: () => void;
  readonly onApply: (selection: { parentId?: string; subcategoryId?: string }) => void;
};

export function TripCategorySheet({
  visible,
  parentId,
  subcategoryId,
  onClose,
  onApply
}: TripCategorySheetProps) {
  const subcategories = getSubcategoriesForParent(parentId);

  return (
    <TripBottomSheet visible={visible} title="Pick category" onClose={onClose}>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Parent category</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {TRIP_CATEGORIES.map((category) => (
          <TripChip
            key={category.id}
            label={category.label}
            selected={parentId === category.id}
            onPress={() => onApply({ parentId: category.id })}
          />
        ))}
      </View>

      {subcategories.length ? (
        <>
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Optional subcategory
          </Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {subcategories.map((subcategory) => (
              <TripChip
                key={subcategory.id}
                label={subcategory.label}
                selected={subcategoryId === subcategory.id}
                onPress={() => onApply({ parentId, subcategoryId: subcategory.id })}
              />
            ))}
          </View>
          <Pressable
            className="self-start rounded-full border border-zinc-300 bg-zinc-100 px-4 py-2"
            onPress={() => onApply({ parentId })}
          >
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Clear subcategory</Text>
          </Pressable>
        </>
      ) : null}
    </TripBottomSheet>
  );
}
