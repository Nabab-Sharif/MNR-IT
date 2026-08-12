import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import type { RootState, AppDispatch } from "./index";
import { fetchCollection, setCollection } from "./dataSlice";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

const EMPTY: any[] = [];

/**
 * Reads a collection from the Redux store, loading it on first use and
 * refreshing whenever the underlying data service reports fresh rows.
 */
export function useCollection<T = any>(storeName: string) {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.data[storeName]);

  useEffect(() => {
    dispatch(fetchCollection(storeName));
    const onRefreshed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.storeName === storeName && Array.isArray(detail.rows)) {
        dispatch(setCollection({ storeName, items: detail.rows }));
      }
    };
    window.addEventListener("mnr-data-refreshed", onRefreshed as EventListener);
    return () => window.removeEventListener("mnr-data-refreshed", onRefreshed as EventListener);
  }, [dispatch, storeName]);

  return {
    items: (slice?.items ?? EMPTY) as T[],
    loading: slice?.status === "loading",
    error: slice?.error ?? null,
    reload: () => dispatch(fetchCollection(storeName)),
  };
}