import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Tarefa agendada: generate-demand-forecast. */
export const Route = createFileRoute("/api/public/jobs/generate-demand-forecast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runDemandForecastAll } = await import("@/lib/jobs.server");
        return Response.json({ ok: true, results: await runDemandForecastAll() });
      },
    },
  },
});
