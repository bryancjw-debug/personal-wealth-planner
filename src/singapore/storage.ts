import { createDefaultProfile } from "./defaults";
import { normalizeProfile } from "./projection";
import type { SingaporePlannerProfile } from "./types";

export const PROFILE_STORE_KEY = "singapore-wealth-planner-react-store";
export const PROFILE_STORE_VERSION = 1;

export interface StoredProfile {
  id: string;
  name: string;
  updatedAt: string;
  profile: SingaporePlannerProfile;
}

export interface ProfileStore {
  version: number;
  activeId: string;
  profiles: StoredProfile[];
}

function profileName(profile: SingaporePlannerProfile) {
  return profile.name?.trim() || "Untitled Profile";
}

function storedProfileName(name: string | undefined, profile: SingaporePlannerProfile) {
  return name?.trim() || profileName(profile);
}

export function createStoredProfile(
  profile: SingaporePlannerProfile,
  id: string = crypto.randomUUID(),
  name?: string,
  updatedAt: string = new Date().toISOString()
): StoredProfile {
  const normalized = normalizeProfile(profile);
  return {
    id,
    name: storedProfileName(name, normalized),
    updatedAt,
    profile: normalized
  };
}

export function createProfileStore(profile = createDefaultProfile()): ProfileStore {
  const stored = createStoredProfile(profile, "default");
  return { version: PROFILE_STORE_VERSION, activeId: stored.id, profiles: [stored] };
}

export function normalizeProfileStore(raw: unknown): ProfileStore {
  const fallback = createProfileStore();
  if (!raw || typeof raw !== "object") return fallback;
  const candidate = raw as Partial<ProfileStore>;
  const profiles = Array.isArray(candidate.profiles)
    ? candidate.profiles
        .filter((item): item is StoredProfile => !!item && typeof item === "object" && "profile" in item)
        .map((item, index) => createStoredProfile(
          normalizeProfile(item.profile),
          item.id || `profile-${index + 1}`,
          typeof item.name === "string" ? item.name : undefined,
          typeof item.updatedAt === "string" && item.updatedAt ? item.updatedAt : undefined
        ))
    : [];
  if (!profiles.length) return fallback;
  const activeId = profiles.some((item) => item.id === candidate.activeId) ? String(candidate.activeId) : profiles[0].id;
  return { version: PROFILE_STORE_VERSION, activeId, profiles };
}

export function loadProfileStore(storage: Pick<Storage, "getItem"> = localStorage): ProfileStore {
  try {
    return normalizeProfileStore(JSON.parse(storage.getItem(PROFILE_STORE_KEY) || "null"));
  } catch {
    return createProfileStore();
  }
}

export function saveProfileStore(store: ProfileStore, storage: Pick<Storage, "setItem"> = localStorage) {
  const normalized = normalizeProfileStore(store);
  storage.setItem(PROFILE_STORE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function activeStoredProfile(store: ProfileStore) {
  return store.profiles.find((profile) => profile.id === store.activeId) ?? store.profiles[0];
}

export function upsertActiveProfile(store: ProfileStore, profile: SingaporePlannerProfile): ProfileStore {
  const normalized = normalizeProfile(profile);
  const active = activeStoredProfile(store);
  const updated = createStoredProfile(normalized, active?.id || crypto.randomUUID(), active?.name);
  return {
    version: PROFILE_STORE_VERSION,
    activeId: updated.id,
    profiles: store.profiles.some((item) => item.id === updated.id)
      ? store.profiles.map((item) => (item.id === updated.id ? updated : item))
      : [...store.profiles, updated]
  };
}

export function addProfile(store: ProfileStore, profile = createDefaultProfile(), name?: string): ProfileStore {
  const stored = createStoredProfile(profile, crypto.randomUUID(), name);
  return { version: PROFILE_STORE_VERSION, activeId: stored.id, profiles: [...store.profiles, stored] };
}

export function renameProfile(store: ProfileStore, id: string, name: string): ProfileStore {
  const nextName = name.trim();
  if (!nextName) return store;
  return {
    ...store,
    profiles: store.profiles.map((profile) => (
      profile.id === id
        ? { ...profile, name: nextName, updatedAt: new Date().toISOString() }
        : profile
    ))
  };
}

export function removeProfile(store: ProfileStore, id: string): ProfileStore {
  const profiles = store.profiles.filter((profile) => profile.id !== id);
  if (!profiles.length) return createProfileStore();
  return {
    version: PROFILE_STORE_VERSION,
    activeId: profiles.some((profile) => profile.id === store.activeId) ? store.activeId : profiles[0].id,
    profiles
  };
}
