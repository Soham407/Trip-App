export type LocalDataScaffold = {
  schemaVersion: number;
  entities: [
    "trips",
    "trip_members",
    "family_groups",
    "family_group_members",
    "packing_lists",
    "ledger_entries"
  ];
  syncMode: "local-only";
  notes: {
    storageAdapter: "watermelondb-planned";
    syncProvider: "supabase-planned";
    activeTripScope: "most-recent-active-trip";
    membershipAccess: "invite-only";
    authProvider: "google-oauth-only";
  };
};

const LOCAL_DATA_SCAFFOLD: LocalDataScaffold = {
  schemaVersion: 2,
  entities: [
    "trips",
    "trip_members",
    "family_groups",
    "family_group_members",
    "packing_lists",
    "ledger_entries"
  ],
  syncMode: "local-only",
  notes: {
    storageAdapter: "watermelondb-planned",
    syncProvider: "supabase-planned",
    activeTripScope: "most-recent-active-trip",
    membershipAccess: "invite-only",
    authProvider: "google-oauth-only"
  }
};

export function getLocalDataScaffold(): LocalDataScaffold {
  return LOCAL_DATA_SCAFFOLD;
}
