import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";

import { TripCard } from "@/components/trip-ui";
import { getSupabaseConfig, supabase } from "@/data/supabaseClient";

type OpsSnapshot = {
  trips: Array<Record<string, unknown>>;
  members: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
  lists: Array<Record<string, unknown>>;
  failedLogs: Array<Record<string, unknown>>;
};

type OpsSectionProps = {
  readonly title: string;
  readonly subtitle: string;
  readonly rows: Array<Record<string, unknown>>;
  readonly columns: readonly string[];
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function OpsSection({ title, subtitle, rows, columns }: OpsSectionProps) {
  return (
    <TripCard className="rounded-[20px] border-[#d6dfd6] bg-[#fbfcf8] p-0">
      <View className="border-b border-[#e4eadf] px-4 py-3">
        <Text className="text-lg font-semibold text-[#17211b]">{title}</Text>
        <Text className="mt-1 text-xs font-medium uppercase tracking-wide text-[#697368]">{subtitle}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View className="min-w-full">
          <View className="flex-row border-b border-[#e4eadf] bg-[#eef3e7]">
            {columns.map((column) => (
              <View key={column} className="min-w-[160px] border-r border-[#dce4d8] px-3 py-2">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-[#415044]">{column}</Text>
              </View>
            ))}
          </View>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <View
                key={`${title}-${rowIndex}`}
                className={rowIndex % 2 === 0 ? "flex-row border-b border-[#eef2ea] bg-white" : "flex-row border-b border-[#eef2ea] bg-[#f8faf4]"}
              >
                {columns.map((column) => (
                  <View key={`${title}-${rowIndex}-${column}`} className="min-w-[160px] border-r border-[#eef2ea] px-3 py-2">
                    <Text className="text-xs leading-5 text-[#1e2b23]">{formatCell(row[column])}</Text>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <View className="px-4 py-6">
              <Text className="text-sm text-[#697368]">No rows returned.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </TripCard>
  );
}

export default function OpsScreen() {
  const [snapshot, setSnapshot] = useState<OpsSnapshot>({
    trips: [],
    members: [],
    ledger: [],
    lists: [],
    failedLogs: []
  });
  const [status, setStatus] = useState("Loading live Supabase data...");
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("Loading live Supabase data...");
      setError(undefined);

      const [tripsResult, membersResult, ledgerResult, listsResult, failedLogsResult] = await Promise.all([
        supabase.from("trips").select("id,destination,starts_on,ends_on,currency,status,sync_status,created_at").order("created_at", { ascending: false }),
        supabase.from("trip_members").select("id,trip_id,display_name,email,invite_status,sync_status").order("trip_id"),
        supabase.from("ledger_entries").select("id,trip_id,label,amount,status,source,sync_status,category_parent_id,category_subcategory_id,created_at").order("created_at", { ascending: false }),
        supabase.from("trip_lists").select("id,trip_id,kind,title,sync_status,created_at").order("created_at", { ascending: false }),
        supabase.from("failed_expense_ingestion_logs").select("id,trip_id,source,reason,sync_status,created_at").order("created_at", { ascending: false })
      ]);

      const firstError =
        tripsResult.error ??
        membersResult.error ??
        ledgerResult.error ??
        listsResult.error ??
        failedLogsResult.error;

      if (cancelled) {
        return;
      }

      if (firstError) {
        setError(firstError.message);
        setStatus("Supabase query failed.");
        return;
      }

      setSnapshot({
        trips: tripsResult.data ?? [],
        members: membersResult.data ?? [],
        ledger: ledgerResult.data ?? [],
        lists: listsResult.data ?? [],
        failedLogs: failedLogsResult.data ?? []
      });
      setStatus("Live Supabase data loaded.");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const config = getSupabaseConfig();

  return (
    <View className="flex-1 bg-[#eff5e8]">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-[1360px] gap-5 px-4 pb-12 pt-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[30px] font-bold tracking-tight text-[#17211b]">Trip Ops Grid</Text>
            <Text className="mt-2 text-sm text-[#546257]">
              Live spreadsheet-style view over the linked Supabase project and the mobile app schema.
            </Text>
          </View>
          <Pressable
            onPress={() => router.replace("/(tabs)")}
            className="h-12 w-12 items-center justify-center rounded-full border border-[#dbe5d4] bg-white"
          >
            <FontAwesome6 name="chevron-left" size={16} color="#17211b" />
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-3">
          <View style={{ flex: 1, minWidth: 180 }}>
            <TripCard className="rounded-[20px] border-[#d6dfd6] bg-white">
              <Text className="text-xs font-semibold uppercase tracking-wide text-[#697368]">Supabase URL</Text>
              <Text className="mt-2 text-sm font-medium text-[#17211b]">{config.url}</Text>
            </TripCard>
          </View>
          <View style={{ flex: 1, minWidth: 180 }}>
            <TripCard className="rounded-[20px] border-[#d6dfd6] bg-white">
              <Text className="text-xs font-semibold uppercase tracking-wide text-[#697368]">Connection</Text>
              <Text className="mt-2 text-sm font-medium text-[#17211b]">{status}</Text>
            </TripCard>
          </View>
          <View style={{ flex: 1, minWidth: 180 }}>
            <TripCard className="rounded-[20px] border-[#d6dfd6] bg-white">
              <Text className="text-xs font-semibold uppercase tracking-wide text-[#697368]">Rows visible</Text>
              <Text className="mt-2 text-sm font-medium text-[#17211b]">
                {snapshot.trips.length + snapshot.members.length + snapshot.ledger.length + snapshot.lists.length + snapshot.failedLogs.length}
              </Text>
            </TripCard>
          </View>
        </View>

        {error ? (
          <View className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3">
            <Text className="text-sm text-rose-900">{error}</Text>
          </View>
        ) : null}

        <OpsSection
          title="Trips"
          subtitle="Core trip headers"
          rows={snapshot.trips}
          columns={["id", "destination", "starts_on", "ends_on", "currency", "status", "sync_status", "created_at"]}
        />
        <OpsSection
          title="Trip Members"
          subtitle="Invite-only roster snapshots"
          rows={snapshot.members}
          columns={["id", "trip_id", "display_name", "email", "invite_status", "sync_status"]}
        />
        <OpsSection
          title="Ledger Entries"
          subtitle="Expenses and imported alerts"
          rows={snapshot.ledger}
          columns={["id", "trip_id", "label", "amount", "status", "source", "sync_status", "category_parent_id", "category_subcategory_id", "created_at"]}
        />
        <OpsSection
          title="Trip Lists"
          subtitle="Shopping and packing headers"
          rows={snapshot.lists}
          columns={["id", "trip_id", "kind", "title", "sync_status", "created_at"]}
        />
        <OpsSection
          title="Failed Imports"
          subtitle="Parser failures"
          rows={snapshot.failedLogs}
          columns={["id", "trip_id", "source", "reason", "sync_status", "created_at"]}
        />
      </ScrollView>
    </View>
  );
}
