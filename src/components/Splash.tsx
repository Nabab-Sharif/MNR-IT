import { Loader2 } from "lucide-react";

export default function Splash({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-4 p-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-400 via-fuchsia-500 to-emerald-400 blur-xl opacity-60 animate-pulse" />
        <img
          src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png"
          alt="MNR"
          className="relative w-20 h-20 rounded-full bg-white p-2 object-contain shadow-2xl ring-4 ring-white/40 animate-[pulse_2s_ease-in-out_infinite]"
        />
      </div>
      <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}