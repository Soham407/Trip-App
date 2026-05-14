import {
  authenticateWithProvider,
  createFamilyGroup,
  createTripFromFamilyGroup,
  getAllTripIdentities,
  getAuthenticatedUser,
  getFamilyGroups,
  removeLocalFamilyGroup,
  removeLocalTripWithMembers,
  type FamilyGroup,
  type TripIdentityUser,
  type TripRecord
} from "@/data/tripIdentityStore";
import { hydrateStoresFromSupabase, getSupabaseSessionUser } from "@/data/cloudBootstrap";
import { supabase } from "@/data/supabaseClient";
import * as Linking from "expo-linking";

export type LaunchRoute = "/auth" | "/setup/family" | "/setup/trip" | "/(tabs)";

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

    const tripMembers = (await import("@/data/tripIdentityStore")).getTripMembers(trip.id);
    const { error: membersError } = await supabase.from("trip_members").upsert(
      tripMembers.map((member) => ({
        id: member.id,
        trip_id: member.tripId,
        display_name: member.displayName,
        email: member.email,
        invite_status: member.inviteStatus,
        invited_by_user_id: member.invitedByUserId,
        invite_token: member.inviteToken,
        sync_status: member.syncStatus
      }))
    );
    if (membersError) throw new Error(`Trip member sync failed: ${membersError.message}`);
  } catch (syncError) {
    removeLocalTripWithMembers(trip.id);
    throw syncError;
  }

  return trip;
}
