import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import * as Linking from "expo-linking";

import {
  categorizeImportedExpense,
  getCurrentTrip,
  getDashboardSnapshot,
  getLedgerEntries,
  getNeedsReviewExpenses,
  subscribeCurrentTripStore,
  uncategorizeImportedExpense,
  getTripCustomCategories
} from "@/data/currentTripStore";
import {
  archiveTrip,
  buildTripInviteUrl,
  createDuplicatedTrip,
  restoreTrip,
  updateTripMemberPermission
} from "@/data/appLaunchService";
import {
  getAllTripIdentities,
  getAuthenticatedUser,
  getCurrentTripIdentity,
  getCurrentUserTripMember,
  getDuplicateTripDraft,
  getPendingTripMembers,
  getTripMembers,
  selectTripIdentity
} from "@/data/tripIdentityStore";
import {
  TripBottomSheet,
  TripCard,
  TripChip,
  TripExpenseReviewSheet,
  TripFeedRow,
  TripScreenShell,
  buildLedgerFeedRows,
  buildTripCategories,
  formatTripCurrency
} from "@/components/trip-ui";

export default function DashboardScreen() {
  const [, setStoreRevision] = useState(0);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>();
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [duplicateSourceTripId, setDuplicateSourceTripId] = useState<string>();
  const [duplicateDestination, setDuplicateDestination] = useState("");
  const [duplicateStartsOn, setDuplicateStartsOn] = useState("");
  const [duplicateEndsOn, setDuplicateEndsOn] = useState("");
  const [tripActionMessage, setTripActionMessage] = useState<string>();

  useEffect(() => subscribeCurrentTripStore(() => setStoreRevision((value) => value + 1)), []);

  const trip = getCurrentTrip();
  const currentTripIdentity = getCurrentTripIdentity();
  const tripMemberId = getCurrentUserTripMember(trip.id)?.id;
  const tripMembers = getTripMembers(currentTripIdentity.id);
  const currentUserMember = tripMembers.find((member) => member.id === tripMemberId);
  const pendingInvites = getPendingTripMembers(currentTripIdentity.id);
  const allTrips = [...getAllTripIdentities()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
  const categories = buildTripCategories(getTripCustomCategories());
  const dashboard = getDashboardSnapshot();
  const ledgerEntries = getLedgerEntries();
  const needsReviewRows = buildLedgerFeedRows(getNeedsReviewExpenses(), trip.currency, categories);
  const recentRows = buildLedgerFeedRows(ledgerEntries, trip.currency, categories).slice(0, 2);
  const totalSpend = ledgerEntries
    .filter((entry) => !entry.deletedAt)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const pendingSpend = ledgerEntries
    .filter((entry) => entry.syncStatus === "pending")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const selectedExpense = useMemo(
    () => ledgerEntries.find((entry) => entry.id === selectedExpenseId),
    [ledgerEntries, selectedExpenseId]
  );

  useEffect(() => {
    if (!duplicateSourceTripId) {
      return;
    }

    const draft = getDuplicateTripDraft(duplicateSourceTripId);
    setDuplicateDestination(draft.destination);
    setDuplicateStartsOn(draft.startsOn);
    setDuplicateEndsOn(draft.endsOn);
  }, [duplicateSourceTripId]);

  async function sendInviteEmail(displayName: string, inviteToken: string) {
    const inviteUrl = buildTripInviteUrl(inviteToken);
    const subject = encodeURIComponent(`Join ${currentTripIdentity.destination} trip`);
    const body = encodeURIComponent(
      `Hi ${displayName},\n\nUse the invited Google account and open this link to join the trip:\n${inviteUrl}\n`
    );

    try {
      await Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
      setTripActionMessage(`Opened an invite email draft for ${displayName}.`);
    } catch {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
        setTripActionMessage(`Copied invite link for ${displayName}.`);
        return;
      }

      setTripActionMessage(`Invite link for ${displayName}: ${inviteUrl}`);
    }
  }

  return (
    <TripScreenShell
      title="My Trip"
      subtitle={`${trip.destination} • ${trip.startsOn} to ${trip.endsOn}${currentTripIdentity.status === "archived" ? " • Archived" : ""}`}
      actionSlot={
        <Pressable
          onPress={() => setTripSheetOpen(true)}
          className="h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-sm"
        >
          <FontAwesome6 name="shuffle" size={18} color="#07110d" />
          {dashboard.needsReviewCount ? (
            <View className="absolute right-1 top-0 rounded-full bg-[#caff68] px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-[#07110d]">{dashboard.needsReviewCount}</Text>
            </View>
          ) : null}
        </Pressable>
      }
    >
      <ScrollView className="flex-1" contentContainerClassName="gap-5 pb-28">
        <TripCard className="items-center bg-[#f7fbf8] py-7">
          <View className="rounded-full bg-white px-4 py-2 shadow-sm">
            <Text className="text-xs font-semibold text-zinc-500">{dashboard.title}</Text>
          </View>
          <Text className="mt-5 text-sm text-zinc-500">Trip spending</Text>
          <Text className="mt-1 text-[42px] font-bold tracking-tight text-[#07110d]">
            {formatTripCurrency(trip.currency, totalSpend)}
          </Text>
          <View className="mt-3 rounded-full bg-[#eef4f1] px-4 py-2">
            <Text className="text-xs font-semibold text-[#5f64b7]">
              Checklist {Math.round(dashboard.checklistProgress * 100)}% complete
            </Text>
          </View>
        </TripCard>

        <View className="flex-row justify-between rounded-[30px] bg-[#eef4f1] p-3">
          {[
            { icon: "receipt", label: "Review", onPress: () => setSelectedExpenseId(needsReviewRows[0]?.id) },
            { icon: "list-check", label: "Lists", onPress: () => router.push("/(tabs)/lists") },
            { icon: "wallet", label: "Cash", onPress: () => router.push("/(tabs)/ledger") },
            { icon: "arrows-rotate", label: "Trips", onPress: () => setTripSheetOpen(true) }
          ].map((item, index) => (
            <Pressable key={item.label} onPress={item.onPress} className="items-center gap-2">
              <View
                className={
                  index === 0
                    ? "h-14 w-14 items-center justify-center rounded-full bg-[#caff68]"
                    : "h-14 w-14 items-center justify-center rounded-full bg-white"
                }
              >
                <FontAwesome6 name={item.icon} size={18} color="#07110d" />
              </View>
              <Text className="text-xs font-medium text-[#07110d]">{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row gap-3">
          <TripCard className="flex-1">
            <Text className="text-xs font-semibold text-zinc-500">Pending sync</Text>
            <Text className="mt-2 text-xl font-bold text-[#07110d]">
              {formatTripCurrency(trip.currency, pendingSpend)}
            </Text>
          </TripCard>
          <TripCard className="flex-1">
            <Text className="text-xs font-semibold text-zinc-500">Ledger entries</Text>
            <Text className="mt-2 text-xl font-bold text-[#07110d]">{dashboard.entryCount}</Text>
          </TripCard>
        </View>

        {needsReviewRows.length ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between px-1">
              <Text className="text-xl font-semibold text-[#07110d]">Needs Review</Text>
              <Text className="text-sm font-medium text-zinc-500">{dashboard.needsReviewCount} items</Text>
            </View>
            {needsReviewRows.map((row) => (
              <TripFeedRow
                key={row.id}
                title={row.title}
                meta={row.meta}
                amountLabel={row.amountLabel}
                categoryLabel={row.categoryLabel}
                onPress={() => setSelectedExpenseId(row.id)}
              />
            ))}
          </View>
        ) : null}

        <View className="gap-2">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-xl font-semibold text-[#07110d]">Transaction History</Text>
              <Pressable onPress={() => router.push("/(tabs)/ledger")}>
                <Text className="text-sm font-medium text-[#07110d]">View all</Text>
              </Pressable>
            </View>
          {recentRows.map((row) => (
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

      <TripExpenseReviewSheet
        visible={!!selectedExpense}
        categories={categories}
        expense={selectedExpense}
        onClose={() => setSelectedExpenseId(undefined)}
        onCategorize={({ categoryParentId, categorySubcategoryId }) => {
          if (!selectedExpenseId || !tripMemberId) {
            return;
          }

          categorizeImportedExpense({
            expenseId: selectedExpenseId,
            actingTripMemberId: tripMemberId,
            categoryParentId,
            categorySubcategoryId
          });
          setSelectedExpenseId(undefined);
        }}
        onUncategorize={() => {
          if (!selectedExpenseId || !tripMemberId) {
            return;
          }

          uncategorizeImportedExpense({
            expenseId: selectedExpenseId,
            actingTripMemberId: tripMemberId
          });
          setSelectedExpenseId(undefined);
        }}
      />

      <TripBottomSheet
        visible={tripSheetOpen}
        title="Switch or duplicate trip"
        onClose={() => {
          setTripSheetOpen(false);
          setDuplicateSourceTripId(undefined);
          setTripActionMessage(undefined);
        }}
      >
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Trips</Text>
        <View className="mb-5 flex-row flex-wrap gap-2">
          {allTrips.map((tripOption) => (
            <TripChip
              key={tripOption.id}
              label={`${tripOption.destination}${tripOption.status === "archived" ? " (Archived)" : ""}`}
              selected={tripOption.id === currentTripIdentity.id}
              onPress={() => {
                selectTripIdentity(tripOption.id);
                setTripActionMessage(`Opened ${tripOption.destination}.`);
              }}
            />
          ))}
        </View>

        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Duplicate from</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {allTrips.map((tripOption) => (
            <TripChip
              key={`duplicate-${tripOption.id}`}
              label={tripOption.destination}
              selected={duplicateSourceTripId === tripOption.id}
              onPress={() => setDuplicateSourceTripId(tripOption.id)}
            />
          ))}
        </View>

        {duplicateSourceTripId ? (
          <View className="gap-2">
            <TextInput
              value={duplicateDestination}
              onChangeText={setDuplicateDestination}
              placeholder="Destination"
              className="rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
            />
            <TextInput
              value={duplicateStartsOn}
              onChangeText={setDuplicateStartsOn}
              placeholder="YYYY-MM-DD"
              className="rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
            />
            <TextInput
              value={duplicateEndsOn}
              onChangeText={setDuplicateEndsOn}
              placeholder="YYYY-MM-DD"
              className="rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
            />
            <Pressable
              onPress={async () => {
                const createdByUserId =
                  getAuthenticatedUser()?.id ?? currentTripIdentity.createdByUserId;

                try {
                  const duplicatedTrip = await createDuplicatedTrip({
                    sourceTripId: duplicateSourceTripId,
                    createdByUserId,
                    destination: duplicateDestination,
                    startsOn: duplicateStartsOn,
                    endsOn: duplicateEndsOn
                  });
                  setTripActionMessage(`Created ${duplicatedTrip.destination} from a previous trip.`);
                  setDuplicateSourceTripId(undefined);
                } catch (error) {
                  setTripActionMessage(
                    error instanceof Error ? error.message : "Unable to duplicate trip."
                  );
                }
              }}
              className="mt-1 self-start rounded-full bg-[#caff68] px-4 py-3"
            >
              <Text className="text-sm font-semibold text-[#07110d]">Duplicate trip</Text>
            </Pressable>
          </View>
        ) : null}

        {tripMemberId && (currentUserMember?.role === "primary-admin" || currentUserMember?.role === "trip-admin") ? (
          <View className="mt-5">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Pending invites
            </Text>
            <View className="gap-2">
              {pendingInvites.length ? pendingInvites.map((member) => (
                <View key={`invite-${member.id}`} className="rounded-2xl border border-zinc-200 bg-[#f7fbf8] px-3 py-3">
                  <Text className="text-sm font-semibold text-[#07110d]">{member.displayName}</Text>
                  <Text className="mt-1 text-xs text-zinc-500">{member.email}</Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    <TripChip
                      label="Send invite email"
                      onPress={() => {
                        void sendInviteEmail(member.displayName, member.inviteToken);
                      }}
                    />
                    <TripChip
                      label="Copy invite link"
                      onPress={() => {
                        const inviteUrl = buildTripInviteUrl(member.inviteToken);

                        if (typeof navigator !== "undefined" && navigator.clipboard) {
                          void navigator.clipboard.writeText(inviteUrl).then(() => {
                            setTripActionMessage(`Copied invite link for ${member.displayName}.`);
                          });
                          return;
                        }

                        setTripActionMessage(`Invite link for ${member.displayName}: ${inviteUrl}`);
                      }}
                    />
                  </View>
                </View>
              )) : (
                <View className="rounded-2xl border border-zinc-200 bg-[#f7fbf8] px-3 py-3">
                  <Text className="text-sm text-zinc-600">All trip members have accepted their invites.</Text>
                </View>
              )}
            </View>

            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Trip permissions
            </Text>
            <View className="gap-2">
              {tripMembers.map((member) => (
                <View key={member.id} className="rounded-2xl border border-zinc-200 bg-[#f7fbf8] px-3 py-3">
                  <Text className="text-sm font-semibold text-[#07110d]">{member.displayName}</Text>
                  <Text className="mt-1 text-xs text-zinc-500">{member.email}</Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {member.role === "primary-admin" ? (
                      <TripChip label="Primary admin" selected />
                    ) : (
                      <>
                        <TripChip
                          label="Member"
                          selected={member.role === "member"}
                          onPress={() => {
                            void updateTripMemberPermission({
                              tripId: currentTripIdentity.id,
                              tripMemberId: member.id,
                              role: "member",
                              actingTripMemberId: tripMemberId
                            }).catch((error) => {
                              setTripActionMessage(
                                error instanceof Error ? error.message : "Unable to update permissions."
                              );
                            });
                          }}
                        />
                        <TripChip
                          label="Trip admin"
                          selected={member.role === "trip-admin"}
                          onPress={() => {
                            void updateTripMemberPermission({
                              tripId: currentTripIdentity.id,
                              tripMemberId: member.id,
                              role: "trip-admin",
                              actingTripMemberId: tripMemberId
                            }).catch((error) => {
                              setTripActionMessage(
                                error instanceof Error ? error.message : "Unable to update permissions."
                              );
                            });
                          }}
                        />
                      </>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Trip status
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <TripChip
                label={currentTripIdentity.status === "archived" ? "Restore trip" : "Archive trip"}
                onPress={() => {
                  if (!tripMemberId) {
                    return;
                  }

                  const action = currentTripIdentity.status === "archived"
                    ? restoreTrip({
                        tripId: currentTripIdentity.id,
                        actingTripMemberId: tripMemberId
                      })
                    : archiveTrip({
                        tripId: currentTripIdentity.id,
                        actingTripMemberId: tripMemberId
                      });

                  void action
                    .then((tripRecord) => {
                      setTripActionMessage(
                        tripRecord.status === "archived"
                          ? `Archived ${tripRecord.destination}.`
                          : `Restored ${tripRecord.destination}.`
                      );
                    })
                    .catch((error) => {
                      setTripActionMessage(
                        error instanceof Error ? error.message : "Unable to update trip status."
                      );
                    });
                }}
              />
            </View>
          </View>
        ) : null}

        {tripActionMessage ? <Text className="mt-3 text-sm text-zinc-600">{tripActionMessage}</Text> : null}
      </TripBottomSheet>
    </TripScreenShell>
  );
}
