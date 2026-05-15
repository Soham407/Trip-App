import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-linking", () => ({
  createURL: (path: string) => `tripappbootstrap:/${path}`
}));

vi.mock("@/data/supabaseClient", () => ({
  supabase: {
    from: () => ({
      upsert: () => Promise.resolve({ error: null }),
      update: () => ({
        eq: () => Promise.resolve({ error: null })
      })
    }),
    auth: {
      getUser: () => Promise.resolve({
        data: {
          user: {
            id: "user-owner-001",
            email: "parent@example.com",
            user_metadata: {
              full_name: "Parent"
            }
          }
        },
        error: null
      })
    }
  }
}));

vi.mock("@/data/cloudBootstrap", () => ({
  hydrateStoresFromSupabase: () => Promise.resolve(),
  getSupabaseSessionUser: () =>
    Promise.resolve({
      id: "user-session-001",
      email: "soham@example.com",
      displayName: "Soham",
      provider: "google"
    })
}));

import {
  acceptTripInviteFromToken,
  archiveTrip,
  buildTripInviteUrl,
  createDuplicatedTrip,
  createInitialTrip,
  createReusableFamilyGroup,
  getLaunchRoute,
  restoreTrip,
  signInWithGoogleProfile
} from "@/data/appLaunchService";
import {
  createTripFromCurrentMembers,
  getAuthenticatedUser,
  getCurrentTripIdentity,
  getFamilyGroups,
  getTripMembers,
  resetTripIdentityStoreForTests
} from "@/data/tripIdentityStore";

describe("auth and setup launch flow", () => {
  beforeEach(() => {
    resetTripIdentityStoreForTests();
  });

  it("starts at Google auth and lands on the most recent active trip after sign-in", () => {
    expect(getLaunchRoute()).toBe("/auth");

    const user = signInWithGoogleProfile({
      email: "parent@example.com",
      displayName: "Parent"
    });

    expect(getAuthenticatedUser()?.id).toBe(user.id);
    expect(getLaunchRoute()).toBe("/(tabs)");

    const latestTrip = createTripFromCurrentMembers({
      createdByUserId: user.id,
      destination: "Osaka",
      startsOn: "2026-12-01",
      endsOn: "2026-12-09",
      currency: "USD"
    });

    expect(latestTrip.currency).toBe("INR");
    expect(getCurrentTripIdentity().id).toBe(latestTrip.id);
  });

  it("creates setup entities with pending sync state and invite-only member snapshots", async () => {
    const user = signInWithGoogleProfile({
      email: "new-parent@example.com",
      displayName: "New Parent"
    });

    const group = await createReusableFamilyGroup({
      name: "Cousins",
      ownerUserId: user.id,
      membersText: "Ria <ria@example.com>\nSam <sam@example.com>"
    });

    const trip = await createInitialTrip({
      familyGroupId: group.id,
      createdByUserId: user.id,
      destination: "Udaipur",
      startsOn: "2026-10-01",
      endsOn: "2026-10-05"
    });

    expect(group.syncStatus).toBe("pending");
    expect(trip.currency).toBe("INR");
    expect(trip.syncStatus).toBe("pending");
    expect(getFamilyGroups().some((candidate) => candidate.id === group.id)).toBe(true);
  });

  it("duplicates a trip through the synced launch service path", async () => {
    const user = signInWithGoogleProfile({
      email: "parent@example.com",
      displayName: "Parent"
    });

    const duplicatedTrip = await createDuplicatedTrip({
      sourceTripId: getCurrentTripIdentity().id,
      createdByUserId: user.id,
      destination: "Bali",
      startsOn: "2026-08-01",
      endsOn: "2026-08-05"
    });

    expect(duplicatedTrip.destination).toBe("Bali");
    expect(getCurrentTripIdentity().id).toBe(duplicatedTrip.id);
  });

  it("archives and restores a trip through the synced launch service path", async () => {
    const trip = getCurrentTripIdentity();
    const adminMemberId = getTripMembers(trip.id).find((member) => member.role === "primary-admin")?.id;

    if (!adminMemberId) {
      throw new Error("expected primary admin");
    }

    const archived = await archiveTrip({
      tripId: trip.id,
      actingTripMemberId: adminMemberId
    });

    expect(archived.status).toBe("archived");

    const restored = await restoreTrip({
      tripId: trip.id,
      actingTripMemberId: adminMemberId
    });

    expect(restored.status).toBe("active");
  });

  it("accepts a trip invite from its token", async () => {
    const inviteUrl = buildTripInviteUrl("invite-seed-1");
    expect(inviteUrl).toContain("tripappbootstrap:/");

    const acceptedTrip = await acceptTripInviteFromToken("invite-seed-1");

    expect(acceptedTrip.id).toBe("trip-active-001");
  });
});
