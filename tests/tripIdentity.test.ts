import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  acceptTripInvite,
  authenticateWithProvider,
  createFamilyGroup,
  createTripFromCurrentMembers,
  createTripFromDuplicate,
  createTripFromFamilyGroup,
  getAuthPolicy,
  getTripAdminMembers,
  getAllTripIdentities,
  getCurrentTripIdentity,
  getDuplicateTripDraft,
  getTripMemberByInviteToken,
  getTripMembers,
  setTripStatus,
  resetTripIdentityStoreForTests
} from "@/data/tripIdentityStore";
import { selectTripIdentity, setTripMemberRole } from "@/data/tripIdentityStore";

describe("trip identity and reusable family group flows", () => {
  beforeEach(() => {
    resetTripIdentityStoreForTests();
  });
  afterEach(() => {
    resetTripIdentityStoreForTests();
  });

  it("supports Google OAuth only", () => {
    expect(getAuthPolicy().allowedProviders).toEqual(["google"]);

    expect(() =>
      authenticateWithProvider("apple", {
        email: "parent@example.com",
        displayName: "Parent"
      })
    ).toThrow(/Google OAuth only/i);

    const user = authenticateWithProvider("google", {
      email: "parent@example.com",
      displayName: "Parent"
    });

    expect(user.provider).toBe("google");
  });

  it("reuses family groups while creating fresh membership snapshots", () => {
    const group = createFamilyGroup({
      name: "Cousins",
      ownerUserId: "user-owner-001",
      members: [
        { displayName: "Ria", email: "ria@example.com" },
        { displayName: "Sam", email: "sam@example.com" }
      ]
    });

    const firstTrip = createTripFromFamilyGroup({
      familyGroupId: group.id,
      createdByUserId: "user-owner-001",
      destination: "Lisbon",
      startsOn: "2026-06-12",
      endsOn: "2026-06-19",
      currency: "EUR"
    });

    const secondTrip = createTripFromFamilyGroup({
      familyGroupId: group.id,
      createdByUserId: "user-owner-001",
      destination: "Rome",
      startsOn: "2026-09-01",
      endsOn: "2026-09-08",
      currency: "EUR"
    });

    const firstMembers = getTripMembers(firstTrip.id);
    const secondMembers = getTripMembers(secondTrip.id);

    expect(firstMembers.map((member) => member.email)).toEqual(["ria@example.com", "sam@example.com"]);
    expect(secondMembers.map((member) => member.email)).toEqual(["ria@example.com", "sam@example.com"]);
    expect(firstMembers[0]?.id).not.toBe(secondMembers[0]?.id);
    expect(secondMembers.every((member) => member.inviteStatus === "pending")).toBe(true);
    expect(secondMembers.every((member) => member.inviteToken.length > 0)).toBe(true);
  });

  it("creates a new trip by copying current members into a new snapshot", () => {
    const currentTrip = getCurrentTripIdentity();
    const currentMembers = getTripMembers(currentTrip.id);

    const nextTrip = createTripFromCurrentMembers({
      createdByUserId: "user-owner-001",
      destination: "Kyoto",
      startsOn: "2026-11-01",
      endsOn: "2026-11-10",
      currency: "JPY"
    });

    const copiedMembers = getTripMembers(nextTrip.id);

    expect(copiedMembers.map((member) => member.email)).toEqual(
      currentMembers.map((member) => member.email)
    );
    expect(copiedMembers[0]?.id).not.toBe(currentMembers[0]?.id);
  });

  it("duplicates a previous trip with editable prefilled fields", () => {
    const sourceTrip = getCurrentTripIdentity();
    const draft = getDuplicateTripDraft(sourceTrip.id);

    const duplicatedTrip = createTripFromDuplicate({
      sourceTripId: sourceTrip.id,
      createdByUserId: "user-owner-001",
      draft: {
        ...draft,
        destination: "Barcelona"
      }
    });

    expect(draft.destination).toBe(sourceTrip.destination);
    expect(duplicatedTrip.destination).toBe("Barcelona");
    expect(duplicatedTrip.startsOn).toBe(sourceTrip.startsOn);
    expect(duplicatedTrip.endsOn).toBe(sourceTrip.endsOn);
  });

  it("opens the app to the most recent active trip by default", () => {
    createTripFromCurrentMembers({
      createdByUserId: "user-owner-001",
      destination: "Seoul",
      startsOn: "2026-10-01",
      endsOn: "2026-10-07",
      currency: "KRW"
    });

    const latestTrip = createTripFromCurrentMembers({
      createdByUserId: "user-owner-001",
      destination: "Osaka",
      startsOn: "2026-12-01",
      endsOn: "2026-12-09",
      currency: "JPY"
    });

    expect(getCurrentTripIdentity().id).toBe(latestTrip.id);
  });

  it("allows switching to an archived trip explicitly", () => {
    const archivedTrip = getAllTripIdentities().find((trip) => trip.status === "archived");

    if (!archivedTrip) {
      throw new Error("expected seeded archived trip");
    }

    selectTripIdentity(archivedTrip.id);

    expect(getCurrentTripIdentity().id).toBe(archivedTrip.id);
    expect(getCurrentTripIdentity().status).toBe("archived");
  });

  it("supports trip admins without allowing primary-admin demotion", () => {
    const trip = getCurrentTripIdentity();
    const members = getTripMembers(trip.id);
    const primaryAdmin = members.find((member) => member.role === "primary-admin");
    const targetMember = members.find((member) => member.role === "member");

    if (!primaryAdmin || !targetMember) {
      throw new Error("expected seeded roles");
    }

    const promoted = setTripMemberRole({
      tripId: trip.id,
      tripMemberId: targetMember.id,
      role: "trip-admin",
      actingTripMemberId: primaryAdmin.id
    });

    expect(promoted.role).toBe("trip-admin");
    expect(getTripAdminMembers(trip.id).map((member) => member.id)).toContain(targetMember.id);

    expect(() =>
      setTripMemberRole({
        tripId: trip.id,
        tripMemberId: primaryAdmin.id,
        role: "member",
        actingTripMemberId: primaryAdmin.id
      })
    ).toThrow(/primary admin/i);
  });

  it("accepts an invite only for the matching email address", () => {
    const invite = getTripMemberByInviteToken("invite-seed-2");

    if (!invite) {
      throw new Error("expected seeded invite");
    }

    expect(() =>
      acceptTripInvite({
        inviteToken: invite.inviteToken,
        userEmail: "wrong@example.com"
      })
    ).toThrow(/invited Google account/i);

    const accepted = acceptTripInvite({
      inviteToken: invite.inviteToken,
      userEmail: invite.email
    });

    expect(accepted.tripMember.inviteStatus).toBe("accepted");
  });

  it("lets a trip admin archive and restore a trip", () => {
    const trip = getCurrentTripIdentity();
    const primaryAdmin = getTripMembers(trip.id).find((member) => member.role === "primary-admin");

    if (!primaryAdmin) {
      throw new Error("expected seeded primary admin");
    }

    const archived = setTripStatus({
      tripId: trip.id,
      status: "archived",
      actingTripMemberId: primaryAdmin.id
    });

    expect(archived.status).toBe("archived");

    const restored = setTripStatus({
      tripId: trip.id,
      status: "active",
      actingTripMemberId: primaryAdmin.id
    });

    expect(restored.status).toBe("active");
  });
});
