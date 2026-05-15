import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import type { LedgerEntry } from "@/data/currentTripStore";
import type { TripCategory } from "@/components/trip-ui/contracts";
import { getSubcategoriesForParent } from "@/components/trip-ui/contracts";
import { TripBottomSheet } from "@/components/trip-ui/TripBottomSheet";
import { TripChip } from "@/components/trip-ui/TripChip";

type TripExpenseReviewSheetProps = {
  readonly visible: boolean;
  readonly categories: readonly TripCategory[];
  readonly expense?: LedgerEntry;
  readonly title?: string;
  readonly primaryActionLabel?: string;
  readonly secondaryActionLabel?: string;
  readonly onClose: () => void;
  readonly onCategorize: (selection: { categoryParentId: string; categorySubcategoryId?: string }) => void;
  readonly onUncategorize: () => void;
  readonly onCreateCategory?: (input: { label: string; parentCategoryId?: string }) => void;
};

export function TripExpenseReviewSheet({
  visible,
  categories,
  expense,
  title = "Review imported expense",
  primaryActionLabel = "Categorize",
  secondaryActionLabel = "Uncategorize",
  onClose,
  onCategorize,
  onUncategorize,
  onCreateCategory
}: TripExpenseReviewSheetProps) {
  const [parentId, setParentId] = useState<string | undefined>();
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>();
  const [customLabel, setCustomLabel] = useState("");

  const selectedParentId = useMemo(
    () => parentId ?? expense?.categoryParentId,
    [expense?.categoryParentId, parentId]
  );
  const selectedSubcategoryId = useMemo(
    () => subcategoryId ?? expense?.categorySubcategoryId,
    [expense?.categorySubcategoryId, subcategoryId]
  );
  const subcategories = getSubcategoriesForParent(selectedParentId, categories);

  const canCategorize = !!selectedParentId;

  return (
    <TripBottomSheet visible={visible} title={title} onClose={onClose}>
      <View className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-3">
        <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Imported details (read-only)
        </Text>
        <Text className="mt-2 text-sm text-zinc-700">Merchant: {expense?.label ?? "Unknown merchant"}</Text>
        <Text className="mt-1 text-sm text-zinc-700">
          Amount: {expense ? expense.amount.toFixed(2) : "0.00"}
        </Text>
        <Text className="mt-1 text-sm text-zinc-700">Timestamp: {expense?.createdAt ?? "Unknown timestamp"}</Text>
      </View>

      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Category</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {categories.map((category) => (
          <TripChip
            key={category.id}
            label={category.label}
            selected={selectedParentId === category.id}
            onPress={() => {
              setParentId(category.id);
              setSubcategoryId(undefined);
            }}
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
                selected={selectedSubcategoryId === subcategory.id}
                onPress={() => setSubcategoryId(subcategory.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      {onCreateCategory ? (
        <View className="mb-4 rounded-2xl border border-zinc-200 bg-[#f7fbf8] p-3">
          <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Add custom {selectedParentId ? "subcategory" : "category"}
          </Text>
          <TextInput
            value={customLabel}
            onChangeText={setCustomLabel}
            placeholder={selectedParentId ? "Custom subcategory" : "Custom category"}
            className="mt-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm text-zinc-900"
          />
          <Pressable
            className="mt-3 self-start rounded-full bg-[#caff68] px-4 py-2"
            onPress={() => {
              const label = customLabel.trim();

              if (!label) {
                return;
              }

              onCreateCategory({
                label,
                parentCategoryId: selectedParentId
              });
              setCustomLabel("");
            }}
          >
            <Text className="text-xs font-semibold uppercase tracking-wide text-[#07110d]">Save custom</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <Pressable
          className="rounded-full border border-teal-600 bg-teal-50 px-4 py-2 disabled:opacity-40"
          disabled={!canCategorize || !expense}
          onPress={() => {
            if (!selectedParentId) {
              return;
            }

            onCategorize({
              categoryParentId: selectedParentId,
              categorySubcategoryId: selectedSubcategoryId
            });
            setParentId(undefined);
            setSubcategoryId(undefined);
          }}
        >
          <Text className="text-xs font-semibold uppercase tracking-wide text-teal-700">{primaryActionLabel}</Text>
        </Pressable>

        <Pressable
          className="rounded-full border border-zinc-300 bg-zinc-100 px-4 py-2 disabled:opacity-40"
          disabled={!expense}
          onPress={() => {
            onUncategorize();
            setParentId(undefined);
            setSubcategoryId(undefined);
          }}
        >
          <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-700">{secondaryActionLabel}</Text>
        </Pressable>
      </View>
    </TripBottomSheet>
  );
}
