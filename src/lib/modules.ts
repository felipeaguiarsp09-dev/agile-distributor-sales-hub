import {
  BarChart3,
  CalendarDays,
  KanbanSquare,
  Package,
  ShoppingBag,
  ShoppingCart,
  Users,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./auth";

export type ModuleItem = {
  to:
    | "/indicadores"
    | "/fluxo-de-vendas"
    | "/pedidos"
    | "/clientes"
    | "/produtos"
    | "/ecommerce"
    | "/agenda"
    | "/metas";
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

const INTERNAL: Role[] = ["vendedor", "supervisor", "administrador"];

/** Os 7 módulos do menu, na ordem definida em docs/PAGINAS.md. */
export const MODULES: ModuleItem[] = [
  { to: "/indicadores", label: "Dashboard", icon: BarChart3, roles: INTERNAL },
  { to: "/fluxo-de-vendas", label: "Fluxo de Vendas", icon: KanbanSquare, roles: INTERNAL },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart, roles: INTERNAL },
  { to: "/clientes", label: "Clientes", icon: Users, roles: INTERNAL },
  { to: "/produtos", label: "Produtos", icon: Package, roles: INTERNAL },
  { to: "/ecommerce", label: "E-commerce", icon: ShoppingBag, roles: [...INTERNAL, "cliente"] },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, roles: INTERNAL },
  { to: "/metas", label: "Metas mensais", icon: Target, roles: ["administrador", "supervisor"] },
];

export function modulesForRole(role: string | null | undefined) {
  return MODULES.filter((m) => m.roles.includes(role as Role));
}
