import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import db from "@/services/indexedDBService";

export type Row = Record<string, any>;

type CollectionState = {
  items: Row[];
  status: "idle" | "loading" | "ready" | "error";
  error?: string | null;
  fetchedAt?: number;
};

type DataState = Record<string, CollectionState>;

const empty: CollectionState = { items: [], status: "idle", error: null };

// Loads a collection through the existing IndexedDB / Cloud service so the
// same stale-while-revalidate cache is reused, then mirrors it into Redux.
export const fetchCollection = createAsyncThunk(
  "data/fetchCollection",
  async (storeName: string) => {
    const items = (await db.getAll(storeName)) as Row[];
    return { storeName, items: items || [] };
  },
);

const dataSlice = createSlice({
  name: "data",
  initialState: {} as DataState,
  reducers: {
    setCollection(state, action: PayloadAction<{ storeName: string; items: Row[] }>) {
      const { storeName, items } = action.payload;
      state[storeName] = { items, status: "ready", error: null, fetchedAt: Date.now() };
    },
    upsertRow(state, action: PayloadAction<{ storeName: string; row: Row }>) {
      const { storeName, row } = action.payload;
      const c = state[storeName] || (state[storeName] = { ...empty });
      const i = c.items.findIndex((r) => r.id === row.id);
      if (i >= 0) c.items[i] = { ...c.items[i], ...row };
      else c.items.push(row);
    },
    removeRow(state, action: PayloadAction<{ storeName: string; id: any }>) {
      const { storeName, id } = action.payload;
      const c = state[storeName];
      if (c) c.items = c.items.filter((r) => r.id !== id);
    },
    clearCollection(state, action: PayloadAction<string>) {
      delete state[action.payload];
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchCollection.pending, (state, action) => {
      const name = action.meta.arg;
      state[name] = { ...(state[name] || empty), status: state[name]?.items?.length ? "ready" : "loading" };
    });
    b.addCase(fetchCollection.fulfilled, (state, action) => {
      const { storeName, items } = action.payload;
      state[storeName] = { items, status: "ready", error: null, fetchedAt: Date.now() };
    });
    b.addCase(fetchCollection.rejected, (state, action) => {
      const name = action.meta.arg;
      state[name] = { ...(state[name] || empty), status: "error", error: action.error.message || "Failed" };
    });
  },
});

export const { setCollection, upsertRow, removeRow, clearCollection } = dataSlice.actions;
export default dataSlice.reducer;