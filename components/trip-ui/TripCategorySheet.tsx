import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import type { TripCategory } from "@/components/trip-ui/contracts";
import { getSubcategoriesForParent } from "@/components/trip-ui/contracts";
import { TripBottomSheet } from "@/components/trip-ui/TripBottomSheet";
import { TripChip } from "@/components/trip-ui/TripChip";

type TripCategorySheetProps = {
  readonly visible: boolean;
  readonly categories: readonly TripCategory[];
  readonly parentId?: string;
  readonly subcategoryId?: string;
  readonly onClose: () => void;
  readonly onApply: (selection: { parentId?: string; subcategoryId?: string }) => void;
  readonly onCreateCategory?: (input: { label: string; parentCategoryId?: string }) => void;
};

export function TripCategorySheet({
  visible,
  categories,
  parentId,
  subcategoryId,
  onClose,
  onApply,
  onCreateCategory
}: TripCategorySheetProps) {
  const [customLabel, setCustomLabel] = useState("");
  const subcategories = getSubcategoriesForParent(parentId, categories);

  return (
    <TripBottomSheet visible={visible} title="Pick category" onClose={onClose}>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Parent category</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {categories.map((category) => (
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

      {onCreateCategory ? (
        <View className="mt-5 rounded-2xl border border-zinc-200 bg-[#f7fbf8] p-3">
          <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Add custom {parentId ? "subcategory" : "category"}
          </Text>
          <View className="mt-3 flex-row gap-2">
            <TextInput
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder={parentId ? "Custom subcategory" : "Custom category"}
              className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            />
            <Pressable
              className="rounded-full bg-[#caff68] px-4 py-2"
              onPress={() => {
                const label = customLabel.trim();

                if (!label) {
                  return;
                }

                onCreateCategory({
                  label,
                  parentCategoryId: parentId
                });
                setCustomLabel("");
              }}
            >
              <Text className="text-xs font-semibold uppercase tracking-wide text-[#07110d]">Save</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </TripBottomSheet>
  );
}
