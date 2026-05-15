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

export type TripMemberRole = "primary-admin" | "trip-admin" | "member";

export type TripMember = {
  readonly id: string;
  readonly tripId: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: TripMemberRole;
  readonly inviteStatus: "pending" | "accepted";
  readonly invitedByUserId: string;
  readonly inviteToken: string;
  readonly syncStatus: SyncStatus;
};

export type InviteAcceptanceResult = {
  readonly tripId: string;
  readonly tripMember: TripMember;
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
  selectedTripId?: string;
  users: TripIdentityUser[];
  groups: FamilyGroup[];
  trips: TripRecord[];
  tripMembers: TripMember[];
};

const listeners = new Set<() => void>();

const AUTH_POLICY: AuthPolicy = {
  allowedProviders: ["google"],
  membershipAccess: "invite-only"
};

const INITIAL_OWNER_USER: TripIdentityUser = {
  id: "user-owner-001",
  email: "soham@example.com",
  displayName: "Soham",
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

function getUserById(userId: string): TripIdentityUser | undefined {
  return state.users.find((user) => user.id === userId);
}

function getTripMemberById(tripId: string, tripMemberId: string): TripMember | undefined {
  return state.tripMembers.find((member) => member.tripId === tripId && member.id === tripMemberId);
}

function buildInitialState(): TripIdentityState {
  return {
    sequence: 100,
    timestampCursor: 2,
    users: [],
    groups: [],
    trips: [],
    tripMembers: []
  };
}

function buildSeedTestState(): TripIdentityState {
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

  const archivedTrip: TripRecord = {
    id: "trip-archive-001",
    destination: "Jaipur",
    startsOn: "2025-12-18",
    endsOn: "2025-12-22",
    currency: "INR",
    status: "archived",
    createdByUserId: INITIAL_OWNER_USER.id,
    createdAt: "2025-12-18T00:00:02Z",
    sourceFamilyGroupId: familyGroup.id,
    syncStatus: "synced"
  };

  const activeTripMembers: TripMember[] = familyGroup.members.map((member, index) => ({
    id: `trip-member-seed-${index + 1}`,
    tripId: activeTrip.id,
    displayName: member.displayName,
    email: sanitizeEmail(member.email),
    role: index === 0 ? "primary-admin" : "member",
    inviteStatus: "accepted",
    invitedByUserId: INITIAL_OWNER_USER.id,
    inviteToken: `invite-seed-${index + 1}`,
    syncStatus: "synced"
  }));

  const archivedTripMembers: TripMember[] = familyGroup.members.map((member, index) => ({
    id: `trip-member-archive-${index + 1}`,
    tripId: archivedTrip.id,
    displayName: member.displayName,
    email: sanitizeEmail(member.email),
    role: index === 0 ? "primary-admin" : "member",
    inviteStatus: "accepted",
    invitedByUserId: INITIAL_OWNER_USER.id,
    inviteToken: `invite-archive-${index + 1}`,
    syncStatus: "synced"
  }));

  return {
    sequence: 100,
    timestampCursor: 2,
    selectedTripId: activeTrip.id,
    users: [INITIAL_OWNER_USER],
    groups: [familyGroup],
    trips: [activeTrip, archivedTrip],
    tripMembers: [...activeTripMembers, ...archivedTripMembers]
  };
}

let state: TripIdentityState = readRepositoryState("trip-identity", buildInitialState);

function saveTripIdentityState(): void {
  writeRepositoryState("trip-identity", state);
  listeners.forEach((listener) => listener());
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
  const inviterEmail = sanitizeEmail(getUserById(invitedByUserId)?.email ?? "");
  const snapshotMembers = members.map((member) => ({
    id: nextId("trip-member"),
    tripId,
    displayName: member.displayName,
    email: sanitizeEmail(member.email),
    role:
      sanitizeEmail(member.email) === inviterEmail
        ? ("primary-admin" as const)
        : ("member" as const),
    inviteStatus:
      sanitizeEmail(member.email) === inviterEmail
        ? ("accepted" as const)
        : ("pending" as const),
    invitedByUserId,
    inviteToken: buildInviteToken(tripId, member.email),
    syncStatus: "pending" as const
  }));

  state.tripMembers.push(...snapshotMembers);
  return snapshotMembers;
}

export function resetTripIdentityStoreForTests(): void {
  state = resetRepositoryState("trip-identity", buildSeedTestState());
  listeners.forEach((listener) => listener());
}

export function hydrateTripIdentityStoreFromRemote(input: {
  readonly sessionUser?: TripIdentityUser;
  readonly users: readonly TripIdentityUser[];
  readonly groups: readonly FamilyGroup[];
  readonly trips: readonly TripRecord[];
  readonly tripMembers: readonly TripMember[];
}): void {
  const previousSelectedTripId = state.selectedTripId;
  const usersById = new Map<string, TripIdentityUser>();

  [...input.users, ...(input.sessionUser ? [input.sessionUser] : [])].forEach((user) => {
    usersById.set(user.id, cloneUser(user));
  });

  state = {
    sequence: 1000,
    timestampCursor: 10,
    sessionUserId: input.sessionUser?.id,
    selectedTripId:
      (previousSelectedTripId && input.trips.some((trip) => trip.id === previousSelectedTripId))
        ? previousSelectedTripId
        : input.trips.find((trip) => trip.status === "active")?.id ?? input.trips[0]?.id,
    users: [...usersById.values()],
    groups: input.groups.map(cloneGroup),
    trips: input.trips.map(cloneTrip),
    tripMembers: input.tripMembers.map(cloneTripMember)
  };
  saveTripIdentityState();
}

export function subscribeTripIdentityStore(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
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

export function removeLocalFamilyGroup(familyGroupId: string): void {
  state.groups = state.groups.filter((group) => group.id !== familyGroupId);
  saveTripIdentityState();
}

export function removeLocalTripWithMembers(tripId: string): void {
  state.trips = state.trips.filter((trip) => trip.id !== tripId);
  state.tripMembers = state.tripMembers.filter((member) => member.tripId !== tripId);

  if (state.selectedTripId === tripId) {
    state.selectedTripId = state.trips.find((trip) => trip.status === "active")?.id ?? state.trips[0]?.id;
  }

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
  const selectedTrip = state.selectedTripId
    ? state.trips.find((trip) => trip.id === state.selectedTripId)
    : undefined;

  if (selectedTrip) {
    return cloneTrip(selectedTrip);
  }

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

export function selectTripIdentity(tripId: string): TripRecord {
  const target = state.trips.find((trip) => trip.id === tripId);

  if (!target) {
    throw new Error(`Trip not found: ${tripId}`);
  }

  state.selectedTripId = target.id;
  saveTripIdentityState();
  return cloneTrip(target);
}

export function getSelectedTripIdentityId(): string | undefined {
  return state.selectedTripId;
}

export function getTripMembers(tripId: string): readonly TripMember[] {
  return state.tripMembers.filter((member) => member.tripId === tripId).map(cloneTripMember);
}

export function getTripAdminMembers(tripId: string): readonly TripMember[] {
  return getTripMembers(tripId).filter(
    (member) => member.role === "primary-admin" || member.role === "trip-admin"
  );
}

export function getCurrentUserTripMember(tripId: string): TripMember | undefined {
  const user = getAuthenticatedUser();

  if (!user) {
    return undefined;
  }

  const userEmail = sanitizeEmail(user.email);
  const match = state.tripMembers.find(
    (member) => member.tripId === tripId && sanitizeEmail(member.email) === userEmail
  );

  return match ? cloneTripMember(match) : undefined;
}

export function getPrimaryAdminTripMember(tripId: string): TripMember | undefined {
  const match = state.tripMembers.find(
    (member) => member.tripId === tripId && member.role === "primary-admin"
  );
  return match ? cloneTripMember(match) : undefined;
}

export function getTripMemberByInviteToken(inviteToken: string): TripMember | undefined {
  const match = state.tripMembers.find((member) => member.inviteToken === inviteToken);
  return match ? cloneTripMember(match) : undefined;
}

export function getPendingTripMembers(tripId: string): readonly TripMember[] {
  return getTripMembers(tripId).filter((member) => member.inviteStatus === "pending");
}

export function setTripMemberRole(input: {
  readonly tripId: string;
  readonly tripMemberId: string;
  readonly role: TripMemberRole;
  readonly actingTripMemberId: string;
}): TripMember {
  const actor = getTripMemberById(input.tripId, input.actingTripMemberId);

  if (!actor) {
    throw new Error("Only a trip admin can manage trip permissions");
  }

  if (actor.role !== "primary-admin" && actor.role !== "trip-admin") {
    throw new Error("Only a trip admin can manage trip permissions");
  }

  const targetIndex = state.tripMembers.findIndex(
    (member) => member.tripId === input.tripId && member.id === input.tripMemberId
  );

  if (targetIndex < 0) {
    throw new Error(`Trip member not found: ${input.tripMemberId}`);
  }

  const target = state.tripMembers[targetIndex];

  if (!target) {
    throw new Error(`Trip member not found: ${input.tripMemberId}`);
  }

  if (target.role === "primary-admin") {
    throw new Error("The primary admin role cannot be changed");
  }

  if (input.role === "primary-admin") {
    throw new Error("Use a dedicated transfer flow to change the primary admin");
  }

  const updated: TripMember = {
    ...target,
    role: input.role,
    syncStatus: "pending"
  };

  state.tripMembers[targetIndex] = updated;
  saveTripIdentityState();
  return cloneTripMember(updated);
}

export function acceptTripInvite(input: {
  readonly inviteToken: string;
  readonly userEmail: string;
}): InviteAcceptanceResult {
  const normalizedEmail = sanitizeEmail(input.userEmail);
  const targetIndex = state.tripMembers.findIndex((member) => member.inviteToken === input.inviteToken);

  if (targetIndex < 0) {
    throw new Error("Invite link is invalid or has expired");
  }

  const target = state.tripMembers[targetIndex];

  if (!target) {
    throw new Error("Invite link is invalid or has expired");
  }

  if (sanitizeEmail(target.email) !== normalizedEmail) {
    throw new Error("Sign in with the invited Google account to accept this trip invite");
  }

  const acceptedMember: TripMember = {
    ...target,
    inviteStatus: "accepted",
    syncStatus: "pending"
  };

  state.tripMembers[targetIndex] = acceptedMember;
  state.selectedTripId = acceptedMember.tripId;
  saveTripIdentityState();

  return {
    tripId: acceptedMember.tripId,
    tripMember: cloneTripMember(acceptedMember)
  };
}

export function setTripStatus(input: {
  readonly tripId: string;
  readonly status: TripRecord["status"];
  readonly actingTripMemberId: string;
}): TripRecord {
  const actor = getTripMemberById(input.tripId, input.actingTripMemberId);

  if (!actor || (actor.role !== "primary-admin" && actor.role !== "trip-admin")) {
    throw new Error("Only a trip admin can change trip status");
  }

  const targetIndex = state.trips.findIndex((trip) => trip.id === input.tripId);

  if (targetIndex < 0) {
    throw new Error(`Trip not found: ${input.tripId}`);
  }

  const target = state.trips[targetIndex];

  if (!target) {
    throw new Error(`Trip not found: ${input.tripId}`);
  }

  const updated: TripRecord = {
    ...target,
    status: input.status,
    syncStatus: "pending"
  };

  state.trips[targetIndex] = updated;

  if (state.selectedTripId === updated.id && updated.status === "archived") {
    state.selectedTripId =
      state.trips.find((trip) => trip.id !== updated.id && trip.status === "active")?.id ?? updated.id;
  }

  saveTripIdentityState();
  return cloneTrip(updated);
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
  state.selectedTripId = trip.id;
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
  state.selectedTripId = trip.id;
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
  state.selectedTripId = trip.id;
  saveTripIdentityState();
  return cloneTrip(trip);
}
