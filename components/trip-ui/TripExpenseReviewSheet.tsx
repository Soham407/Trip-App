import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { LedgerEntry } from "@/data/currentTripStore";
import { TRIP_CATEGORIES, getSubcategoriesForParent } from "@/components/trip-ui/contracts";
import { TripBottomSheet } from "@/components/trip-ui/TripBottomSheet";
import { TripChip } from "@/components/trip-ui/TripChip";

type TripExpenseReviewSheetProps = {
  readonly visible: boolean;
  readonly expense?: LedgerEntry;
  readonly onClose: () => void;
  readonly onCategorize: (selection: { categoryParentId: string; categorySubcategoryId?: string }) => void;
  readonly onUncategorize: () => void;
};

export function TripExpenseReviewSheet({
  visible,
  expense,
  onClose,
  onCategorize,
  onUncategorize
}: TripExpenseReviewSheetProps) {
  const [parentId, setParentId] = useState<string | undefined>();
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>();

  const selectedParentId = useMemo(
    () => parentId ?? expense?.categoryParentId,
    [expense?.categoryParentId, parentId]
  );
  const selectedSubcategoryId = useMemo(
    () => subcategoryId ?? expense?.categorySubcategoryId,
    [expense?.categorySubcategoryId, subcategoryId]
  );
  const subcategories = getSubcategoriesForParent(selectedParentId);

  const canCategorize = !!selectedParentId;

  return (
    <TripBottomSheet visible={visible} title="Review imported expense" onClose={onClose}>
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
        {TRIP_CATEGORIES.map((category) => (
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
          <Text className="text-xs font-semibold uppercase tracking-wide text-teal-700">Categorize</Text>
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
          <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Uncategorize</Text>
        </Pressable>
      </View>
    </TripBottomSheet>
  );
}
