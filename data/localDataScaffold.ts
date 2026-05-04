export type LocalDataScaffold = {
  schemaVersion: number;
  entities: ["trips", "packing_lists", "ledger_entries"];
  syncMode: "local-only";
  notes: {
    storageAdapter: "watermelondb-planned";
    syncProvider: "supabase-planned";
    activeTripScope: "single-active-trip";
  };
};

const LOCAL_DATA_SCAFFOLD: LocalDataScaffold = {
  schemaVersion: 1,
  entities: ["trips", "packing_lists", "ledger_entries"],
  syncMode: "local-only",
  notes: {
    storageAdapter: "watermelondb-planned",
    syncProvider: "supabase-planned",
    activeTripScope: "single-active-trip",
  },
};

export function getLocalDataScaffold(): LocalDataScaffold {
  return LOCAL_DATA_SCAFFOLD;
}
