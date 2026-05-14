import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-linking", () => ({
  createURL: (path: string) => `tripappbootstrap:/${path}`
}));

vi.mock("@/data/supabaseClient", () => ({
  supabase: {
    from: () => ({
      upsert: () => Promise.resolve({ error: null })
    })
  }
}));

import {
  createInitialTrip,
  createReusableFamilyGroup,
  getLaunchRoute,
  signInWithGoogleProfile
} from "@/data/appLaunchService";
import {
  createTripFromCurrentMembers,
  getAuthenticatedUser,
  getCurrentTripIdentity,
  getFamilyGroups,
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
});
