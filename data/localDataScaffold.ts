export type LocalDataScaffold = {
  schemaVersion: number;
  entities: [
    "trips",
    "trip_members",
    "family_groups",
    "family_group_members",
    "trip_lists",
    "ledger_entries"
  ];
  syncMode: "prototype-local-store-sync-ready";
  notes: {
    storageAdapter: "repository-store-prototype";
    syncProvider: "supabase";
    activeTripScope: "selected-trip";
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
    "trip_lists",
    "ledger_entries"
  ],
  syncMode: "prototype-local-store-sync-ready",
  notes: {
    storageAdapter: "repository-store-prototype",
    syncProvider: "supabase",
    activeTripScope: "selected-trip",
    membershipAccess: "invite-only",
    authProvider: "google-oauth-only"
  }
};

export function getLocalDataScaffold(): LocalDataScaffold {
  return LOCAL_DATA_SCAFFOLD;
}
