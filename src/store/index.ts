import { configureStore } from "@reduxjs/toolkit";
import data, { setCollection } from "./dataSlice";
import ui from "./uiSlice";
import { readSnapshots } from "@/services/indexedDBService";

// Hydrate from the localStorage snapshot cache so the very first render
// already has last-known data (cloud rows refresh in the background).
const preloadedData = (() => {
  try {
    const snaps = readSnapshots();
    const out: Record<string, any[]> = {};
    Object.entries(snaps).forEach(([k, items]) => {
      if (Array.isArray(items)) out[k] = items;
    });
    return out;
  } catch {
    return {} as Record<string, any[]>;
  }
})();

export const store = configureStore({
  reducer: { data, ui },
  middleware: (getDefault) => getDefault({ serializableCheck: false }),
});

// Seed cached collections immediately after store creation.
Object.entries(preloadedData).forEach(([storeName, items]) => {
  store.dispatch(setCollection({ storeName, items: items as any[] }));
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;