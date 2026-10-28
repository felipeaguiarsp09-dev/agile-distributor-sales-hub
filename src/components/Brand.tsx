import logoMark from "@/assets/dcalice-logo-mark.png";

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 shrink-0 items-center rounded-md bg-primary px-2 ring-1 ring-sidebar-foreground/25">
        <img
          src={logoMark}
          alt=""
          aria-hidden="true"
          className="h-6 w-auto object-contain"
        />
      </span>
      <span
        className={`font-display text-xl font-bold tracking-tight ${inverted ? "text-sidebar-foreground" : "text-foreground"}`}
      >
        Dcalice
      </span>
    </div>
  );
}
