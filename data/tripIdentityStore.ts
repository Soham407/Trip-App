import {
  readRepositoryState,
  resetRepositoryState,
  writeRepositoryState,
  type SyncStatus
} from "@/data/localFirstRepository";

export type AuthProvider = "google";

export type TripIdentityUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly provider: AuthProvider;
};

export type AuthPolicy = {
  readonly allowedProviders: readonly AuthProvider[];
  readonly membershipAccess: "invite-only";
};

export type FamilyGroupMemberTemplate = {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
};

export type FamilyGroup = {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly members: readonly FamilyGroupMemberTemplate[];
  readonly createdAt: string;
  readonly syncStatus: SyncStatus;
};

export type TripRecord = {
  readonly id: string;
  readonly destination: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly currency: string;
  readonly status: "active" | "archived";
  readonly createdByUserId: string;
  readonly createdAt: string;
  readonly sourceFamilyGroupId?: string;
  readonly sourceTripId?: string;
  readonly syncStatus: SyncStatus;
};

export type TripMember = {
  readonly id: string;
  readonly tripId: string;
  readonly displayName: string;
  readonly email: string;
  readonly inviteStatus: "pending" | "accepted";
  readonly invitedByUserId: string;
  readonly inviteToken: string;
  readonly syncStatus: SyncStatus;
};

export type TripFields = {
  readonly destination: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly currency: string;
};

export type CreateFamilyGroupInput = {
  readonly name: string;
  readonly ownerUserId: string;
  readonly members: readonly { readonly displayName: string; readonly email: string }[];
};

export type CreateTripFromFamilyGroupInput = TripFields & {
  readonly familyGroupId: string;
  readonly createdByUserId: string;
};

export type CreateTripFromCurrentMembersInput = TripFields & {
  readonly createdByUserId: string;
};

export type DuplicateTripDraft = TripFields;

export type CreateTripFromDuplicateInput = {
  readonly sourceTripId: string;
  readonly createdByUserId: string;
  readonly draft: DuplicateTripDraft;
};

type TripIdentityState = {
  sequence: number;
  timestampCursor: number;
  sessionUserId?: string;
  users: TripIdentityUser[];
  groups: FamilyGroup[];
  trips: TripRecord[];
  tripMembers: TripMember[];
};

const AUTH_POLICY: AuthPolicy = {
  allowedProviders: ["google"],
  membershipAccess: "invite-only"
};

const INITIAL_OWNER_USER: TripIdentityUser = {
  id: "user-owner-001",
  email: "parent@example.com",
  displayName: "Parent",
  provider: "google"
};

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function cloneUser(user: TripIdentityUser): TripIdentityUser {
  return { ...user };
}

function cloneGroup(group: FamilyGroup): FamilyGroup {
  return {
    ...group,
    members: group.members.map((member) => ({ ...member }))
  };
}

function cloneTrip(trip: TripRecord): TripRecord {
  return { ...trip };
}

function cloneTripMember(member: TripMember): TripMember {
  return { ...member };
}

function buildInitialState(): TripIdentityState {
  const familyGroup: FamilyGroup = {
    id: "family-group-001",
    name: "Primary Family",
    ownerUserId: INITIAL_OWNER_USER.id,
    createdAt: "2026-01-01T00:00:01Z",
    syncStatus: "synced",
    members: [
      { id: "group-member-001", displayName: "Soham", email: "soham@example.com" },
      { id: "group-member-002", displayName: "Ava", email: "ava@example.com" },
      { id: "group-member-003", displayName: "Liam", email: "liam@example.com" },
      { id: "group-member-004", displayName: "Nora", email: "nora@example.com" }
    ]
  };

  const activeTrip: TripRecord = {
    id: "trip-active-001",
    destination: "Goa",
    startsOn: "2026-06-12",
    endsOn: "2026-06-19",
    currency: "INR",
    status: "active",
    createdByUserId: INITIAL_OWNER_USER.id,
    createdAt: "2026-01-01T00:00:02Z",
    sourceFamilyGroupId: familyGroup.id,
    syncStatus: "synced"
  };

  const activeTripMembers: TripMember[] = familyGroup.members.map((member, index) => ({
    id: `trip-member-seed-${index + 1}`,
    tripId: activeTrip.id,
    displayName: member.displayName,
    email: sanitizeEmail(member.email),
    inviteStatus: "accepted",
    invitedByUserId: INITIAL_OWNER_USER.id,
    inviteToken: `invite-seed-${index + 1}`,
    syncStatus: "synced"
  }));

  return {
    sequence: 100,
    timestampCursor: 2,
    users: [INITIAL_OWNER_USER],
    groups: [familyGroup],
    trips: [activeTrip],
    tripMembers: activeTripMembers
  };
}

let state: TripIdentityState = readRepositoryState("trip-identity", buildInitialState);

function saveTripIdentityState(): void {
  writeRepositoryState("trip-identity", state);
}

function nextId(prefix: string): string {
  state.sequence += 1;
  return `${prefix}-${String(state.sequence).padStart(4, "0")}`;
}

function nextTimestamp(): string {
  state.timestampCursor += 1;
  return `2026-01-01T00:00:${String(state.timestampCursor).padStart(2, "0")}Z`;
}

function buildInviteToken(tripId: string, email: string): string {
  return `${tripId}-${sanitizeEmail(email).replace(/[^a-z0-9]/g, "")}-${nextId("invite")}`;
}

function createTripRecord(input: TripFields & { createdByUserId: string; sourceFamilyGroupId?: string; sourceTripId?: string }): TripRecord {
  const record: TripRecord = {
    id: nextId("trip"),
    destination: input.destination,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    currency: "INR",
    status: "active",
    createdByUserId: input.createdByUserId,
    createdAt: nextTimestamp(),
    sourceFamilyGroupId: input.sourceFamilyGroupId,
    sourceTripId: input.sourceTripId,
    syncStatus: "pending"
  };

  state.trips.push(record);
  return record;
}

function createSnapshotMembers(
  tripId: string,
  invitedByUserId: string,
  members: readonly { readonly displayName: string; readonly email: string }[]
): TripMember[] {
  const snapshotMembers = members.map((member) => ({
    id: nextId("trip-member"),
    tripId,
    displayName: member.displayName,
    email: sanitizeEmail(member.email),
    inviteStatus: "pending" as const,
    invitedByUserId,
    inviteToken: buildInviteToken(tripId, member.email),
    syncStatus: "pending" as const
  }));

  state.tripMembers.push(...snapshotMembers);
  return snapshotMembers;
}

export function resetTripIdentityStoreForTests(): void {
  state = resetRepositoryState("trip-identity", buildInitialState());
}

export function getAuthPolicy(): AuthPolicy {
  return AUTH_POLICY;
}

export function authenticateWithProvider(
  provider: string,
  profile: { readonly email: string; readonly displayName: string }
): TripIdentityUser {
  if (provider !== "google") {
    throw new Error("Google OAuth only is supported");
  }

  const email = sanitizeEmail(profile.email);
  const existingUser = state.users.find((user) => sanitizeEmail(user.email) === email);

  if (existingUser) {
    state.sessionUserId = existingUser.id;
    saveTripIdentityState();
    return cloneUser(existingUser);
  }

  const user: TripIdentityUser = {
    id: nextId("user"),
    email,
    displayName: profile.displayName,
    provider: "google"
  };

  state.users.push(user);
  state.sessionUserId = user.id;
  saveTripIdentityState();
  return cloneUser(user);
}

export function getAuthenticatedUser(): TripIdentityUser | undefined {
  const sessionUserId = state.sessionUserId;

  if (!sessionUserId) {
    return undefined;
  }

  const user = state.users.find((candidate) => candidate.id === sessionUserId);
  return user ? cloneUser(user) : undefined;
}

export function signOut(): void {
  state.sessionUserId = undefined;
  saveTripIdentityState();
}

export function createFamilyGroup(input: CreateFamilyGroupInput): FamilyGroup {
  if (input.members.length === 0) {
    throw new Error("Family group requires at least one member");
  }

  const group: FamilyGroup = {
    id: nextId("family-group"),
    name: input.name,
    ownerUserId: input.ownerUserId,
    createdAt: nextTimestamp(),
    syncStatus: "pending",
    members: input.members.map((member) => ({
      id: nextId("group-member"),
      displayName: member.displayName,
      email: sanitizeEmail(member.email)
    }))
  };

  state.groups.push(group);
  saveTripIdentityState();
  return cloneGroup(group);
}

export function getFamilyGroups(): readonly FamilyGroup[] {
  return state.groups.map(cloneGroup);
}

export function getCurrentTripIdentity(): TripRecord {
  const activeTrips = state.trips.filter((trip) => trip.status === "active");

  if (activeTrips.length === 0) {
    throw new Error("No active trip available");
  }

  const mostRecentActiveTrip = [...activeTrips].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  )[activeTrips.length - 1];

  return cloneTrip(mostRecentActiveTrip);
}

export function getAllTripIdentities(): readonly TripRecord[] {
  return state.trips.map(cloneTrip);
}

export function getTripMembers(tripId: string): readonly TripMember[] {
  return state.tripMembers.filter((member) => member.tripId === tripId).map(cloneTripMember);
}

export function createTripFromFamilyGroup(input: CreateTripFromFamilyGroupInput): TripRecord {
  const familyGroup = state.groups.find((group) => group.id === input.familyGroupId);

  if (!familyGroup) {
    throw new Error(`Family group not found: ${input.familyGroupId}`);
  }

  const trip = createTripRecord({
    destination: input.destination,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    currency: input.currency,
    createdByUserId: input.createdByUserId,
    sourceFamilyGroupId: familyGroup.id
  });

  createSnapshotMembers(trip.id, input.createdByUserId, familyGroup.members);
  saveTripIdentityState();
  return cloneTrip(trip);
}

export function createTripFromCurrentMembers(input: CreateTripFromCurrentMembersInput): TripRecord {
  const sourceTrip = getCurrentTripIdentity();
  const sourceMembers = state.tripMembers.filter((member) => member.tripId === sourceTrip.id);

  const trip = createTripRecord({
    destination: input.destination,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    currency: input.currency,
    createdByUserId: input.createdByUserId,
    sourceTripId: sourceTrip.id
  });

  createSnapshotMembers(trip.id, input.createdByUserId, sourceMembers);
  saveTripIdentityState();
  return cloneTrip(trip);
}

export function getDuplicateTripDraft(sourceTripId: string): DuplicateTripDraft {
  const sourceTrip = state.trips.find((trip) => trip.id === sourceTripId);

  if (!sourceTrip) {
    throw new Error(`Trip not found: ${sourceTripId}`);
  }

  return {
    destination: sourceTrip.destination,
    startsOn: sourceTrip.startsOn,
    endsOn: sourceTrip.endsOn,
    currency: sourceTrip.currency
  };
}

export function createTripFromDuplicate(input: CreateTripFromDuplicateInput): TripRecord {
  const sourceTrip = state.trips.find((trip) => trip.id === input.sourceTripId);

  if (!sourceTrip) {
    throw new Error(`Trip not found: ${input.sourceTripId}`);
  }

  const sourceMembers = state.tripMembers.filter((member) => member.tripId === sourceTrip.id);

  const trip = createTripRecord({
    destination: input.draft.destination,
    startsOn: input.draft.startsOn,
    endsOn: input.draft.endsOn,
    currency: input.draft.currency,
    createdByUserId: input.createdByUserId,
    sourceTripId: sourceTrip.id,
    sourceFamilyGroupId: sourceTrip.sourceFamilyGroupId
  });

  createSnapshotMembers(trip.id, input.createdByUserId, sourceMembers);
  saveTripIdentityState();
  return cloneTrip(trip);
}
