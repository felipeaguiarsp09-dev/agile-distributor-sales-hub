import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePage";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Dcalice" },
      { name: "description", content: "Visitas planejadas e check-in em campo." },
      { property: "og:title", content: "Agenda — Dcalice" },
      { property: "og:description", content: "Visitas planejadas e check-in em campo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ModulePlaceholder title="Agenda" description="Visitas planejadas e check-in em campo." icon={CalendarDays} />,
});
