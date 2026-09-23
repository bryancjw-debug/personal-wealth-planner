import { describe, expect, it } from "vitest";
import { createQuickStartProfile } from "./defaults";
import { addProfile, createProfileStore, loadProfileStore, renameProfile, saveProfileStore, upsertActiveProfile } from "./storage";

function memoryStorage(seed = new Map<string, string>()) {
  return {
    getItem: (key: string) => seed.get(key) ?? null,
    setItem: (key: string, value: string) => {
      seed.set(key, value);
    }
  };
}

describe("versioned profile storage", () => {
  it("creates a normalized single-profile store", () => {
    const store = createProfileStore();
    expect(store.version).toBe(1);
    expect(store.profiles).toHaveLength(1);
    expect(store.activeId).toBe(store.profiles[0].id);
  });

  it("saves, loads, and preserves the active profile", () => {
    const storage = memoryStorage();
    let store = createProfileStore();
    store = addProfile(store, createQuickStartProfile());
    saveProfileStore(store, storage);
    const loaded = loadProfileStore(storage);
    expect(loaded.profiles).toHaveLength(2);
    expect(loaded.activeId).toBe(store.activeId);
  });

  it("keeps the saved profile label stable when profile data is saved", () => {
    const profile = createQuickStartProfile();
    profile.name = "Bryan";
    const named = renameProfile(createProfileStore(), "default", "Bryan's Retirement Plan");
    const store = upsertActiveProfile(named, profile);
    expect(store.profiles[0].name).toBe("Bryan's Retirement Plan");
    expect(store.profiles[0].profile.monthlyIncome).toBe(6000);
  });

  it("names new profiles and preserves renamed labels through storage normalization", () => {
    const storage = memoryStorage();
    let store = addProfile(createProfileStore(), createQuickStartProfile(), "Family Plan");
    store = renameProfile(store, store.activeId, "Bryan & Partner");
    saveProfileStore(store, storage);

    const loaded = loadProfileStore(storage);
    expect(loaded.profiles.find((profile) => profile.id === loaded.activeId)?.name).toBe("Bryan & Partner");
  });
});
