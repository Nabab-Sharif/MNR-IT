import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { readOutbox, flushOutbox } from "@/lib/offlineQueue";

export default function OfflineIndicator() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(() => readOutbox().length);

  useEffect(() => {
    const on = () => { setOnline(true); void flushOutbox(); };
    const off = () => setOnline(false);
    const changed = () => setPending(readOutbox().length);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("mnr-outbox-changed", changed);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("mnr-outbox-changed", changed);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div className="no-print fixed bottom-3 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs sm:text-sm shadow-lg text-card-foreground">
      {online ? <RefreshCw className="h-4 w-4 animate-spin text-primary" /> : <WifiOff className="h-4 w-4 text-destructive" />}
      <span>
        {online
          ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…`
          : `Offline${pending ? ` — ${pending} change${pending === 1 ? "" : "s"} will save when online` : ""}`}
      </span>
    </div>
  );
}
