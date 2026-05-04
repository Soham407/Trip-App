import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { getCurrentTrip, getLedgerEntries } from "@/data/currentTripStore";
import {
  TripCategorySheet,
  TripChip,
  TripFeedRow,
  TripScreenShell,
  buildLedgerFeedRows,
  resolveCategoryLabel
} from "@/components/trip-ui";

export default function LedgerScreen() {
  const trip = getCurrentTrip();
  const entries = getLedgerEntries();
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>();
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>();

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!selectedParentId) {
        return true;
      }

      if (entry.categoryParentId !== selectedParentId) {
        return false;
      }

      if (!selectedSubcategoryId) {
        return true;
      }

      return entry.categorySubcategoryId === selectedSubcategoryId;
    });
  }, [entries, selectedParentId, selectedSubcategoryId]);

  const rows = buildLedgerFeedRows(filteredEntries, trip.currency);
  const selectedLabel = resolveCategoryLabel(selectedParentId, selectedSubcategoryId);

  return (
    <TripScreenShell title="Ledger" subtitle="Shared spending for the current trip">
      <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
        <View className="flex-row items-center justify-between rounded-2xl border border-amber-100 bg-white p-3">
          <View className="flex-row items-center gap-2">
            <TripChip label={selectedParentId ? selectedLabel : "All categories"} selected={!!selectedParentId} />
          </View>
          <Pressable
            onPress={() => setCategorySheetOpen(true)}
            className="rounded-full border border-teal-600 bg-teal-50 px-4 py-2"
          >
            <Text className="text-xs font-semibold uppercase tracking-wide text-teal-700">Pick category</Text>
          </Pressable>
        </View>

        <View className="gap-2">
          {rows.map((row) => (
            <TripFeedRow
              key={row.id}
              title={row.title}
              meta={row.meta}
              amountLabel={row.amountLabel}
              categoryLabel={row.categoryLabel}
            />
          ))}
        </View>
      </ScrollView>

      <TripCategorySheet
        visible={categorySheetOpen}
        parentId={selectedParentId}
        subcategoryId={selectedSubcategoryId}
        onClose={() => setCategorySheetOpen(false)}
        onApply={({ parentId, subcategoryId }) => {
          setSelectedParentId(parentId);
          setSelectedSubcategoryId(subcategoryId);
          setCategorySheetOpen(false);
        }}
      />
    </TripScreenShell>
  );
}
