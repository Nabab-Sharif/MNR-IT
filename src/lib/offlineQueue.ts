// Offline outbox: when the network is down, cloud writes are stored locally
// and replayed automatically when the connection comes back.
import { supabase } from "@/integrations/supabase/client";

export type OutboxOp =
  | { kind: "insert"; table: string; row: Record<string, any> }
  | { kind: "upsert"; table: string; row: Record<string, any> }
  | { kind: "update"; table: string; id: any; row: Record<string, any> }
  | { kind: "delete"; table: string; id: any }
  | { kind: "deleteIn"; table: string; ids: any[] };

const KEY = "mnr_outbox";

export function readOutbox(): (OutboxOp & { qid: string })[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function writeOutbox(list: any[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* quota */ }
  try { window.dispatchEvent(new CustomEvent("mnr-outbox-changed", { detail: { count: list.length } })); } catch { /* noop */ }
}

export function isOfflineError(e: any): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = String(e?.message || e || "");
  return e instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed|fetch/i.test(msg);
}

export function enqueue(op: OutboxOp) {
  const list = readOutbox();
  list.push({ ...op, qid: `${Date.now()}-${Math.random().toString(36).slice(2)}` } as any);
  writeOutbox(list);
}

async function runOp(op: OutboxOp) {
  const t = supabase.from(op.table as any) as any;
  let res: any;
  switch (op.kind) {
    case "insert": res = await t.upsert(op.row, { onConflict: "id" }); break;
    case "upsert": res = await t.upsert(op.row, { onConflict: "id" }); break;
    case "update": res = await t.update(op.row).eq("id", op.id); break;
    case "delete": res = await t.delete().eq("id", op.id); break;
    case "deleteIn": res = await t.delete().in("id", op.ids); break;
  }
  if (res?.error) throw res.error;
}

let flushing = false;
export async function flushOutbox(): Promise<number> {
  if (flushing) return 0;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  flushing = true;
  let done = 0;
  try {
    let list = readOutbox();
    while (list.length) {
      const op = list[0];
      try {
        await runOp(op);
      } catch (e) {
        if (isOfflineError(e)) break; // still offline — retry later
        console.warn("[outbox] dropped failed op", op, e);
      }
      list = readOutbox().filter((o) => o.qid !== op.qid);
      writeOutbox(list);
      done++;
    }
    if (done) {
      try { window.dispatchEvent(new CustomEvent("mnr-outbox-flushed", { detail: { done } })); } catch { /* noop */ }
    }
  } finally {
    flushing = false;
  }
  return done;
}

export function newId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushOutbox(); });
  setInterval(() => { if (readOutbox().length) void flushOutbox(); }, 30000);
  setTimeout(() => { void flushOutbox(); }, 3000);
}
