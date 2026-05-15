import type { User } from "@supabase/supabase-js";

import {
  hydrateCurrentTripStoreFromRemote,
  type FailedExpenseIngestionLog,
  type LedgerActivity,
  type LedgerEntry,
  type TripCustomCategory,
  type TripList
} from "@/data/currentTripStore";
import { supabase } from "@/data/supabaseClient";
import {
  hydrateTripIdentityStoreFromRemote,
  getAuthenticatedUser,
  type FamilyGroup,
  type TripIdentityUser,
  type TripMember,
  type TripRecord
} from "@/data/tripIdentityStore";

function isLocalPrototypeMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function appUserFromSupabaseUser(user: User): TripIdentityUser {
  return {
    id: user.id,
    email: user.email?.toLowerCase() ?? "",
    displayName:
      String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "Traveler"),
    provider: "google"
  };
}

export async function getSupabaseSessionUser(): Promise<TripIdentityUser | undefined> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.email) {
    return undefined;
  }

  return appUserFromSupabaseUser(data.user);
}

export async function ensureCloudUser(): Promise<TripIdentityUser | undefined> {
  const sessionUser = await getSupabaseSessionUser();

  if (!sessionUser) {
    return undefined;
  }

  const { error: upsertError } = await supabase.from("app_users").upsert({
    id: sessionUser.id,
    email: sessionUser.email,
    display_name: sessionUser.displayName,
    provider: "google",
    supabase_auth_user_id: sessionUser.id
  });
  if (upsertError) {
    console.warn("app_users upsert failed:", upsertError.message);
  }

  return sessionUser;
}

export async function hydrateStoresFromSupabase(): Promise<void> {
  const sessionUser = await ensureCloudUser();

  if (!sessionUser) {
    if (isLocalPrototypeMode() && getAuthenticatedUser()) {
      return;
    }

    hydrateTripIdentityStoreFromRemote({
      users: [],
      groups: [],
      trips: [],
      tripMembers: []
    });
    hydrateCurrentTripStoreFromRemote({
      lists: [],
      ledgerEntries: [],
      failedLogs: []
    });
    return;
  }

  const [
    usersResult,
    groupsResult,
    groupMembersResult,
    tripsResult,
    tripMembersResult,
    tripCategoriesResult,
    listsResult,
    listItemsResult,
    ledgerResult,
    activitiesResult,
    failedLogsResult,
    ledgerLocksResult
  ] = await Promise.all([
    supabase.from("app_users").select("id,email,display_name,provider"),
    supabase.from("family_groups").select("id,name,owner_user_id,created_at,sync_status"),
    supabase.from("family_group_members").select("id,family_group_id,display_name,email"),
    supabase.from("trips").select("*").order("created_at", { ascending: true }),
    supabase.from("trip_members").select("*"),
    supabase.from("trip_categories").select("*"),
    supabase.from("trip_lists").select("*"),
    supabase.from("trip_list_items").select("*"),
    supabase.from("ledger_entries").select("*"),
    supabase.from("ledger_activities").select("*"),
    supabase.from("failed_expense_ingestion_logs").select("*"),
    supabase.from("ledger_edit_locks").select("*")
  ]);

  if (usersResult.error) console.warn("app_users fetch failed:", usersResult.error.message);
  if (groupsResult.error) console.warn("family_groups fetch failed:", groupsResult.error.message);
  if (groupMembersResult.error) console.warn("family_group_members fetch failed:", groupMembersResult.error.message);
  if (tripsResult.error) console.warn("trips fetch failed:", tripsResult.error.message);
  if (tripMembersResult.error) console.warn("trip_members fetch failed:", tripMembersResult.error.message);
  if (tripCategoriesResult.error) console.warn("trip_categories fetch failed:", tripCategoriesResult.error.message);
  if (listsResult.error) console.warn("trip_lists fetch failed:", listsResult.error.message);
  if (listItemsResult.error) console.warn("trip_list_items fetch failed:", listItemsResult.error.message);
  if (ledgerResult.error) console.warn("ledger_entries fetch failed:", ledgerResult.error.message);
  if (activitiesResult.error) console.warn("ledger_activities fetch failed:", activitiesResult.error.message);
  if (failedLogsResult.error) console.warn("failed_expense_ingestion_logs fetch failed:", failedLogsResult.error.message);
  if (ledgerLocksResult.error) console.warn("ledger_edit_locks fetch failed:", ledgerLocksResult.error.message);

  const groupMembersByGroupId = new Map<string, FamilyGroup["members"]>();
  (groupMembersResult.data ?? []).forEach((row) => {
    const familyGroupId = String(row.family_group_id);
    groupMembersByGroupId.set(familyGroupId, [
      ...(groupMembersByGroupId.get(familyGroupId) ?? []),
      {
        id: String(row.id),
        displayName: String(row.display_name),
        email: String(row.email)
      }
    ]);
  });

  const users: TripIdentityUser[] = (usersResult.data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    provider: "google"
  }));

  const groups: FamilyGroup[] = (groupsResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    ownerUserId: String(row.owner_user_id),
    createdAt: String(row.created_at),
    syncStatus: row.sync_status as FamilyGroup["syncStatus"],
    members: groupMembersByGroupId.get(String(row.id)) ?? []
  }));

  const trips: TripRecord[] = (tripsResult.data ?? []).map((row) => ({
    id: String(row.id),
    destination: String(row.destination),
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on),
    currency: String(row.currency),
    status: row.status as TripRecord["status"],
    createdByUserId: String(row.created_by_user_id),
    createdAt: String(row.created_at),
    sourceFamilyGroupId: row.source_family_group_id ? String(row.source_family_group_id) : undefined,
    sourceTripId: row.source_trip_id ? String(row.source_trip_id) : undefined,
    syncStatus: row.sync_status as TripRecord["syncStatus"]
  }));

  const tripMembers: TripMember[] = (tripMembersResult.data ?? []).map((row) => ({
    id: String(row.id),
    tripId: String(row.trip_id),
    displayName: String(row.display_name),
    email: String(row.email),
    role: (row.trip_role ?? "member") as TripMember["role"],
    inviteStatus: row.invite_status as TripMember["inviteStatus"],
    invitedByUserId: row.invited_by_user_id != null ? String(row.invited_by_user_id) : "",
    inviteToken: row.invite_token != null ? String(row.invite_token) : "",
    syncStatus: row.sync_status as TripMember["syncStatus"]
  }));

  const tripCategories: TripCustomCategory[] = (tripCategoriesResult.data ?? []).map((row) => ({
    id: String(row.id),
    tripId: String(row.trip_id),
    label: String(row.label),
    parentCategoryId: row.parent_category_id ? String(row.parent_category_id) : undefined,
    syncStatus: row.sync_status as TripCustomCategory["syncStatus"]
  }));

  const itemsByListId = new Map<string, TripList["items"]>();
  (listItemsResult.data ?? []).forEach((row) => {
    const listId = String(row.list_id);
    itemsByListId.set(listId, [
      ...(itemsByListId.get(listId) ?? []),
      {
        id: String(row.id),
        label: String(row.label),
        checked: Boolean(row.checked),
        syncStatus: row.sync_status as TripList["syncStatus"]
      }
    ]);
  });

  const lists: TripList[] = (listsResult.data ?? []).map((row) => ({
    id: String(row.id),
    tripId: String(row.trip_id),
    kind: row.kind as TripList["kind"],
    title: String(row.title),
    syncStatus: row.sync_status as TripList["syncStatus"],
    items: itemsByListId.get(String(row.id)) ?? []
  }));

  const ledgerEntries: LedgerEntry[] = (ledgerResult.data ?? []).map((row) => ({
    id: String(row.id),
    tripId: String(row.trip_id),
    label: String(row.label),
    amount: Number(row.amount),
    paidBy: String(row.paid_by),
    createdAt: String(row.created_at),
    categoryParentId: row.category_parent_id ? String(row.category_parent_id) : undefined,
    categorySubcategoryId: row.category_subcategory_id ? String(row.category_subcategory_id) : undefined,
    status: row.status as LedgerEntry["status"],
    source: row.source as LedgerEntry["source"],
    syncStatus: row.sync_status as LedgerEntry["syncStatus"],
    isCash: Boolean(row.is_cash),
    deletedAt: row.deleted_at ? String(row.deleted_at) : undefined,
    deletedByTripMemberId: row.deleted_by_trip_member_id ? String(row.deleted_by_trip_member_id) : undefined,
    updatedByTripMemberId: row.updated_by_trip_member_id ? String(row.updated_by_trip_member_id) : undefined
  }));

  const ledgerActivities: LedgerActivity[] = (activitiesResult.data ?? []).map((row) => ({
    id: String(row.id),
    tripId: String(row.trip_id),
    ledgerEntryId: row.ledger_entry_id ? String(row.ledger_entry_id) : undefined,
    actingTripMemberId: String(row.acting_trip_member_id),
    type: row.type as LedgerActivity["type"],
    message: String(row.message),
    createdAt: String(row.created_at)
  }));

  const failedLogs: FailedExpenseIngestionLog[] = (failedLogsResult.data ?? []).map((row) => ({
    id: String(row.id),
    tripId: String(row.trip_id),
    source: row.source as FailedExpenseIngestionLog["source"],
    rawPayload: String(row.raw_payload),
    reason: String(row.reason),
    createdAt: String(row.created_at),
    syncStatus: row.sync_status as FailedExpenseIngestionLog["syncStatus"]
  }));

  const ledgerEditLocks = (ledgerLocksResult.data ?? []).map((row) => ({
    id: String(row.id),
    tripId: String(row.trip_id),
    ledgerEntryId: String(row.ledger_entry_id),
    actingTripMemberId: String(row.acting_trip_member_id),
    acquiredAt: String(row.acquired_at),
    expiresAt: String(row.expires_at)
  }));

  hydrateTripIdentityStoreFromRemote({
    sessionUser,
    users,
    groups,
    trips,
    tripMembers
  });
  hydrateCurrentTripStoreFromRemote({
    lists,
    tripCategories,
    ledgerEntries,
    failedLogs,
    ledgerActivities,
    ledgerEditLocks
  });
}

export function subscribeToCurrentTripRealtime(tripId: string): () => void {
  const channel = supabase
    .channel(`trip-realtime:${tripId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ledger_entries", filter: `trip_id=eq.${tripId}` },
      () => {
        void hydrateStoresFromSupabase().catch(() => {});
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
      () => {
        void hydrateStoresFromSupabase().catch(() => {});
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_members", filter: `trip_id=eq.${tripId}` },
      () => {
        void hydrateStoresFromSupabase().catch(() => {});
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ledger_activities", filter: `trip_id=eq.${tripId}` },
      () => {
        void hydrateStoresFromSupabase().catch(() => {});
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_list_items" },
      () => {
        void hydrateStoresFromSupabase().catch(() => {});
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ledger_edit_locks", filter: `trip_id=eq.${tripId}` },
      () => {
        void hydrateStoresFromSupabase().catch(() => {});
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_categories", filter: `trip_id=eq.${tripId}` },
      () => {
        void hydrateStoresFromSupabase().catch(() => {});
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "failed_expense_ingestion_logs", filter: `trip_id=eq.${tripId}` },
      () => {
        void hydrateStoresFromSupabase().catch(() => {});
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
