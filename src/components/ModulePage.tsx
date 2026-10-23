import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Módulo ainda não construído (entra na Fase 2 do plano). */
export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center rounded-lg border border-dashed bg-card px-6 py-16 text-center shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
          <Icon className="h-6 w-6" />
        </span>
        <p className="mt-4 font-semibold">Módulo em construção</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Este módulo será liberado na próxima fase do Dcalice.
        </p>
        {children}
      </div>
    </div>
  );
}
