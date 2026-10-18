import { useEffect } from "react";
import { useAppSelector } from "@/store/hooks";

/**
 * Mirrors a collection held in the Redux store into a page's local state.
 * The store is hydrated from the snapshot cache before first paint and
 * refreshed in the background, so pages show data instantly and update as
 * soon as fresh rows arrive.
 */
export function useReduxRows<T = any>(
  storeName: string,
  apply: (rows: T[]) => void,
) {
  const items = useAppSelector((s) => s.data[storeName]?.items) as T[] | undefined;

  useEffect(() => {
    if (Array.isArray(items) && items.length) apply(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}
