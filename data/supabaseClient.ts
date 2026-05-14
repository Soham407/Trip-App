import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://oyospqalwrambxnfehxr.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_A0a9LTExxoOj2R38YnrenQ_veT7ZAUb";

const webStorage = {
  getItem: (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  removeItem: (key: string) => globalThis.localStorage?.removeItem(key)
};

const serverStorageValues = new Map<string, string>();
const serverStorage = {
  getItem: (key: string) => serverStorageValues.get(key) ?? null,
  setItem: (key: string, value: string) => {
    serverStorageValues.set(key, value);
  },
  removeItem: (key: string) => {
    serverStorageValues.delete(key);
  }
};

function getAuthStorage() {
  if (process.env.NODE_ENV === "test") {
    return serverStorage;
  }

  if (typeof window === "undefined") {
    return serverStorage;
  }

  if (typeof document !== "undefined") {
    return webStorage;
  }

  return require("@react-native-async-storage/async-storage").default;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: getAuthStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: typeof document !== "undefined"
  }
});

export function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    publishableKeyConfigured: !!SUPABASE_PUBLISHABLE_KEY
  };
}
