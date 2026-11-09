import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const CREDIT_LABEL: Record<string, string> = { ok: "Liberado", restrito: "Bloqueado", bloqueado: "Bloqueado" };

/** Selo verde/vermelho, a única cor fora do tema grafite. */
export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${ok ? "bg-success text-success-foreground" : "bg-danger text-danger-foreground"}`}>
      {label}
    </span>
  );
}

export function CreditBadge({ status }: { status: string }) {
  return <StatusPill ok={status === "ok"} label={CREDIT_LABEL[status] ?? status} />;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <StatusPill ok={active} label={active ? "Ativo" : "Inativo"} />;
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-lg border bg-card px-6 py-12 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="mt-3 font-medium">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed bg-card px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function NoAccess() {
  return <EmptyState title="Você não tem acesso a esta página." />;
}
