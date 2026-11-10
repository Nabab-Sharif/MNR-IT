# Project Notes

## Data fetching
- Every cloud (Lovable Cloud / Supabase) list fetch MUST paginate with `.range()` and sort with a deterministic tie-breaker (`order("created_at")` + `order("id")`). A plain `.select()` returns only the first 1000 rows, and many migrated rows share the same `created_at`, so an unstable sort duplicates/skips rows across pages. Applies to `src/services/indexedDBService.js` (`fetchFresh`) and `src/services/dbService.js` (`cloudFetch`).

## CCTV Daily Check List
- Auto-save/auto-fill of missing daily checklists is removed by user request — checklists are created only via "New Daily Checklist" (manual save). Do not reintroduce automatic checklist creation.
- Cloud list snapshots are stored in IndexedDB (`mnr_snapshots` store) as well as localStorage; large collections exceed the localStorage quota and otherwise re-download fully on every refresh.
- Cloud writes patch the in-memory list (`upsertLocal`/`removeLocal`) instead of invalidating it, and `patchLocal` never builds a list from nothing — a partial list showed only the changed row ("1 report").
