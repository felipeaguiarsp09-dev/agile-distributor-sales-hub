import { TrendingUp } from "lucide-react";

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <TrendingUp className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span
        className={`font-display text-xl font-bold tracking-tight ${inverted ? "text-sidebar-foreground" : "text-foreground"}`}
      >
        Dcalice
      </span>
    </div>
  );
}
