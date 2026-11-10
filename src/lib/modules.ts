import {
  CalendarDays,
  KanbanSquare,
  Package,
  ShoppingCart,
  Users,
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
    | "/agenda"
    | "/metas";
  label: string;
  icon: LucideIcon;
  roles: Role[];
};

const INTERNAL: Role[] = ["vendedor", "supervisor", "administrador"];

/** App só cria pedidos: Dashboard, Agenda, Metas e Propostas ficam ocultos (registros preservados). Os módulos do menu; o histórico dos últimos 12 meses vive dentro de Pedidos. */
export const MODULES: ModuleItem[] = [
  { to: "/fluxo-de-vendas", label: "Fluxo de Vendas", icon: KanbanSquare, roles: INTERNAL },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart, roles: INTERNAL },
  { to: "/clientes", label: "Clientes", icon: Users, roles: INTERNAL },
  { to: "/produtos", label: "Produtos", icon: Package, roles: INTERNAL },
];

export function modulesForRole(role: string | null | undefined) {
  return MODULES.filter((m) => m.roles.includes(role as Role));
}
