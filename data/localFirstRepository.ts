export type SyncStatus = "pending" | "synced" | "failed";

export type LocalFirstEntity = {
  readonly id: string;
  readonly syncStatus?: SyncStatus;
  readonly updatedAt?: string;
};

export type DataLayerRuntime = {
  readonly authProvider: "google-oauth-only";
  readonly localAdapter: "watermelondb";
  readonly remoteAdapter: "supabase";
  readonly activeTripScope: "most-recent-active-trip";
  readonly membershipAccess: "invite-only";
  readonly editLockTtlSeconds: 30;
};

export type RepositoryNamespace = "trip-identity" | "current-trip";

const STORAGE_PREFIX = "trip-app.v1.";
const memoryStorage = new Map<string, string>();

function storageKey(namespace: RepositoryNamespace): string {
  return `${STORAGE_PREFIX}${namespace}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined {
  const storage = globalThis.localStorage;

  if (!storage) {
    return undefined;
  }

  return storage;
}

export function getDataLayerRuntime(): DataLayerRuntime {
  return {
    authProvider: "google-oauth-only",
    localAdapter: "watermelondb",
    remoteAdapter: "supabase",
    activeTripScope: "most-recent-active-trip",
    membershipAccess: "invite-only",
    editLockTtlSeconds: 30
  };
}

export function readRepositoryState<T>(
  namespace: RepositoryNamespace,
  buildSeedState: () => T
): T {
  const key = storageKey(namespace);
  const stored = getStorage()?.getItem(key) ?? memoryStorage.get(key);

  if (!stored) {
    const seed = buildSeedState();
    writeRepositoryState(namespace, seed);
    return cloneJson(seed);
  }

  try {
    return JSON.parse(stored) as T;
  } catch {
    const seed = buildSeedState();
    writeRepositoryState(namespace, seed);
    return cloneJson(seed);
  }
}

export function writeRepositoryState<T>(namespace: RepositoryNamespace, state: T): void {
  const key = storageKey(namespace);
  const serialized = JSON.stringify(state);
  const storage = getStorage();

  if (storage) {
    storage.setItem(key, serialized);
  }

  memoryStorage.set(key, serialized);
}

export function resetRepositoryState<T>(namespace: RepositoryNamespace, seed: T): T {
  writeRepositoryState(namespace, seed);
  return cloneJson(seed);
}

export function clearRepositoryState(namespace: RepositoryNamespace): void {
  const key = storageKey(namespace);
  getStorage()?.removeItem(key);
  memoryStorage.delete(key);
}
