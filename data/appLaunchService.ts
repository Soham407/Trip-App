import {
  acceptTripInvite,
  authenticateWithProvider,
  createFamilyGroup,
  createTripFromDuplicate,
  createTripFromFamilyGroup,
  getAllTripIdentities,
  getAuthenticatedUser,
  getFamilyGroups,
  getTripMembers,
  setTripStatus,
  removeLocalFamilyGroup,
  removeLocalTripWithMembers,
  setTripMemberRole,
  type FamilyGroup,
  type TripMember,
  type TripMemberRole,
  type TripIdentityUser,
  type TripRecord
} from "@/data/tripIdentityStore";
import { hydrateStoresFromSupabase, getSupabaseSessionUser } from "@/data/cloudBootstrap";
import { ensureTripWorkspace } from "@/data/currentTripStore";
import { supabase } from "@/data/supabaseClient";
import * as Linking from "expo-linking";

export type LaunchRoute = "/auth" | "/setup/family" | "/setup/trip" | "/(tabs)";

const PROTOTYPE_PROFILES = [
  { email: "soham@example.com", displayName: "Soham" },
  { email: "ava@example.com", displayName: "Ava" },
  { email: "liam@example.com", displayName: "Liam" },
  { email: "nora@example.com", displayName: "Nora" }
] as const;

export function isLocalPrototypeMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function ensurePrototypeWorkspace(ownerUserId: string): void {
  if (getFamilyGroups().length > 0 && getAllTripIdentities().length > 0) {
    return;
  }

  const group = createFamilyGroup({
    name: "Primary Family",
    ownerUserId,
    members: PROTOTYPE_PROFILES.map((profile) => ({
      displayName: profile.displayName,
      email: profile.email
    }))
  });

  createTripFromFamilyGroup({
    familyGroupId: group.id,
    createdByUserId: ownerUserId,
    destination: "Goa",
    startsOn: "2026-05-18",
    endsOn: "2026-05-25",
    currency: "INR"
  });
}

export function getLaunchRoute(): LaunchRoute {
  const user = getAuthenticatedUser();

  if (!user) {
    return "/auth";
  }

  if (getFamilyGroups().length === 0) {
    return "/setup/family";
  }

  const hasActiveTrip = getAllTripIdentities().some((trip) => trip.status === "active");

  if (!hasActiveTrip) {
    return "/setup/trip";
  }

  return "/(tabs)";
}

export async function getLaunchRouteAsync(): Promise<LaunchRoute> {
  const sessionUser = await getSupabaseSessionUser();

  if (!sessionUser) {
    if (isLocalPrototypeMode() && getAuthenticatedUser()) {
      return getLaunchRoute();
    }

    return "/auth";
  }

  await hydrateStoresFromSupabase();
  return getLaunchRoute();
}

export async function signInWithGoogleOAuth(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: typeof document !== "undefined" ? window.location.origin : Linking.createURL("/")
    }
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function signInWithGoogleProfile(profile: {
  readonly email: string;
  readonly displayName: string;
}): TripIdentityUser {
  return authenticateWithProvider("google", profile);
}

export function getPrototypeProfiles(): readonly { readonly email: string; readonly displayName: string }[] {
  return PROTOTYPE_PROFILES;
}

export function signInWithPrototypeProfile(profile: {
  readonly email: string;
  readonly displayName: string;
}): TripIdentityUser {
  const user = authenticateWithProvider("google", profile);
  ensurePrototypeWorkspace(user.id);
  ensureTripWorkspace(getAllTripIdentities().find((trip) => trip.status === "active")?.id ?? "");
  return user;
}

async function syncTripMembers(tripMembers: readonly TripMember[]): Promise<void> {
  const { error: membersError } = await supabase.from("trip_members").upsert(
    tripMembers.map((member) => ({
      id: member.id,
      trip_id: member.tripId,
      display_name: member.displayName,
      email: member.email,
      trip_role: member.role,
      invite_status: member.inviteStatus,
      invited_by_user_id: member.invitedByUserId,
      invite_token: member.inviteToken,
      sync_status: member.syncStatus
    }))
  );
  if (membersError) throw new Error(`Trip member sync failed: ${membersError.message}`);
}

async function ensureCloudTripLists(tripId: string): Promise<void> {
  ensureTripWorkspace(tripId);

  const { error } = await supabase.from("trip_lists").upsert([
    {
      id: `list-shopping-${tripId}`,
      trip_id: tripId,
      kind: "shopping",
      title: "Shopping",
      sync_status: "pending"
    },
    {
      id: `list-packing-${tripId}`,
      trip_id: tripId,
      kind: "packing",
      title: "Packing",
      sync_status: "pending"
    }
  ]);

  if (error) {
    throw new Error(`Trip list sync failed: ${error.message}`);
  }
}

export async function createReusableFamilyGroup(input: {
  readonly name: string;
  readonly ownerUserId: string;
  readonly membersText: string;
}): Promise<FamilyGroup> {
  const members = input.membersText
    .split(/\n|,/)
    .map((member) => member.trim())
    .filter(Boolean)
    .map((member) => {
      const [displayName = "", email = ""] = member.split("<");
      const cleanEmail = email.replace(">", "").trim();

      return {
        displayName: displayName.trim() || cleanEmail,
        email: cleanEmail || member.trim().toLowerCase()
      };
    });

  const group = createFamilyGroup({
    name: input.name,
    ownerUserId: input.ownerUserId,
    members
  });

  try {
    const { error } = await supabase.from("family_groups").upsert({
      id: group.id,
      name: group.name,
      owner_user_id: group.ownerUserId,
      created_at: group.createdAt,
      sync_status: group.syncStatus
    });
    if (error) throw new Error(`Family group sync failed: ${error.message}`);

    const { error: membersError } = await supabase.from("family_group_members").upsert(
      group.members.map((member) => ({
        id: member.id,
        family_group_id: group.id,
        display_name: member.displayName,
        email: member.email
      }))
    );
    if (membersError) throw new Error(`Family member sync failed: ${membersError.message}`);
  } catch (syncError) {
    removeLocalFamilyGroup(group.id);
    throw syncError;
  }

  return group;
}

export async function createInitialTrip(input: {
  readonly familyGroupId: string;
  readonly createdByUserId: string;
  readonly destination: string;
  readonly startsOn: string;
  readonly endsOn: string;
}): Promise<TripRecord> {
  const trip = createTripFromFamilyGroup({
    familyGroupId: input.familyGroupId,
    createdByUserId: input.createdByUserId,
    destination: input.destination,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    currency: "INR"
  });

  try {
    const { error } = await supabase.from("trips").upsert({
      id: trip.id,
      destination: trip.destination,
      starts_on: trip.startsOn,
      ends_on: trip.endsOn,
      currency: trip.currency,
      status: trip.status,
      created_by_user_id: trip.createdByUserId,
      created_at: trip.createdAt,
      source_family_group_id: trip.sourceFamilyGroupId ?? null,
      source_trip_id: trip.sourceTripId ?? null,
      sync_status: trip.syncStatus
    });
    if (error) throw new Error(`Trip sync failed: ${error.message}`);

    await syncTripMembers(getTripMembers(trip.id));
    await ensureCloudTripLists(trip.id);
  } catch (syncError) {
    removeLocalTripWithMembers(trip.id);
    throw syncError;
  }

  return trip;
}

export async function createDuplicatedTrip(input: {
  readonly sourceTripId: string;
  readonly createdByUserId: string;
  readonly destination: string;
  readonly startsOn: string;
  readonly endsOn: string;
}): Promise<TripRecord> {
  const trip = createTripFromDuplicate({
    sourceTripId: input.sourceTripId,
    createdByUserId: input.createdByUserId,
    draft: {
      destination: input.destination,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      currency: "INR"
    }
  });

  try {
    const { error } = await supabase.from("trips").upsert({
      id: trip.id,
      destination: trip.destination,
      starts_on: trip.startsOn,
      ends_on: trip.endsOn,
      currency: trip.currency,
      status: trip.status,
      created_by_user_id: trip.createdByUserId,
      created_at: trip.createdAt,
      source_family_group_id: trip.sourceFamilyGroupId ?? null,
      source_trip_id: trip.sourceTripId ?? null,
      sync_status: trip.syncStatus
    });
    if (error) throw new Error(`Trip sync failed: ${error.message}`);

    await syncTripMembers(getTripMembers(trip.id));
    await ensureCloudTripLists(trip.id);
  } catch (syncError) {
    removeLocalTripWithMembers(trip.id);
    throw syncError;
  }

  return trip;
}

export async function updateTripMemberPermission(input: {
  readonly tripId: string;
  readonly tripMemberId: string;
  readonly role: Exclude<TripMemberRole, "primary-admin">;
  readonly actingTripMemberId: string;
}): Promise<TripMember> {
  const previousMember = getTripMembers(input.tripId).find((member) => member.id === input.tripMemberId);

  if (!previousMember) {
    throw new Error(`Trip member not found: ${input.tripMemberId}`);
  }

  const updatedMember = setTripMemberRole({
    tripId: input.tripId,
    tripMemberId: input.tripMemberId,
    role: input.role,
    actingTripMemberId: input.actingTripMemberId
  });

  const { error } = await supabase.from("trip_members").upsert({
    id: updatedMember.id,
    trip_id: updatedMember.tripId,
    display_name: updatedMember.displayName,
    email: updatedMember.email,
    trip_role: updatedMember.role,
    invite_status: updatedMember.inviteStatus,
    invited_by_user_id: updatedMember.invitedByUserId,
    invite_token: updatedMember.inviteToken,
    sync_status: updatedMember.syncStatus
  });

  if (error) {
    setTripMemberRole({
      tripId: input.tripId,
      tripMemberId: input.tripMemberId,
      role: previousMember.role,
      actingTripMemberId: input.actingTripMemberId
    });
    throw new Error(`Trip member sync failed: ${error.message}`);
  }

  return updatedMember;
}

export async function archiveTrip(input: {
  readonly tripId: string;
  readonly actingTripMemberId: string;
}): Promise<TripRecord> {
  const archivedTrip = setTripStatus({
    tripId: input.tripId,
    status: "archived",
    actingTripMemberId: input.actingTripMemberId
  });

  const { error } = await supabase
    .from("trips")
    .update({
      status: archivedTrip.status,
      sync_status: archivedTrip.syncStatus
    })
    .eq("id", archivedTrip.id);

  if (error) {
    throw new Error(`Trip archive failed: ${error.message}`);
  }

  return archivedTrip;
}

export async function restoreTrip(input: {
  readonly tripId: string;
  readonly actingTripMemberId: string;
}): Promise<TripRecord> {
  const restoredTrip = setTripStatus({
    tripId: input.tripId,
    status: "active",
    actingTripMemberId: input.actingTripMemberId
  });

  const { error } = await supabase
    .from("trips")
    .update({
      status: restoredTrip.status,
      sync_status: restoredTrip.syncStatus
    })
    .eq("id", restoredTrip.id);

  if (error) {
    throw new Error(`Trip restore failed: ${error.message}`);
  }

  return restoredTrip;
}

export function buildTripInviteUrl(inviteToken: string): string {
  return Linking.createURL("/invite", {
    queryParams: {
      token: inviteToken
    }
  });
}

export async function acceptTripInviteFromToken(inviteToken: string): Promise<TripRecord> {
  const sessionUser = await getSupabaseSessionUser();

  if (!sessionUser) {
    throw new Error("Sign in with Google before accepting a trip invite");
  }

  const accepted = acceptTripInvite({
    inviteToken,
    userEmail: sessionUser.email
  });

  const { error } = await supabase
    .from("trip_members")
    .update({
      invite_status: accepted.tripMember.inviteStatus,
      sync_status: accepted.tripMember.syncStatus
    })
    .eq("id", accepted.tripMember.id);

  if (error) {
    throw new Error(`Invite acceptance failed: ${error.message}`);
  }

  await hydrateStoresFromSupabase();

  const trip = getAllTripIdentities().find((candidate) => candidate.id === accepted.tripId);

  if (!trip) {
    throw new Error("Accepted trip is unavailable");
  }

  return trip;
}
