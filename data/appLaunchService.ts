import {
  authenticateWithProvider,
  createFamilyGroup,
  createTripFromFamilyGroup,
  getAllTripIdentities,
  getAuthenticatedUser,
  getFamilyGroups,
  type FamilyGroup,
  type TripIdentityUser,
  type TripRecord
} from "@/data/tripIdentityStore";

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

export function signInWithGoogleProfile(profile: {
  readonly email: string;
  readonly displayName: string;
}): TripIdentityUser {
  return authenticateWithProvider("google", profile);
}

export function createReusableFamilyGroup(input: {
  readonly name: string;
  readonly ownerUserId: string;
  readonly membersText: string;
}): FamilyGroup {
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

  return createFamilyGroup({
    name: input.name,
    ownerUserId: input.ownerUserId,
    members
  });
}

export function createInitialTrip(input: {
  readonly familyGroupId: string;
  readonly createdByUserId: string;
  readonly destination: string;
  readonly startsOn: string;
  readonly endsOn: string;
}): TripRecord {
  return createTripFromFamilyGroup({
    familyGroupId: input.familyGroupId,
    createdByUserId: input.createdByUserId,
    destination: input.destination,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    currency: "INR"
  });
}
