import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Tarefa agendada: generate-indicator-insight. */
export const Route = createFileRoute("/api/public/jobs/generate-indicator-insight")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runIndicatorInsightAll } = await import("@/lib/jobs.server");
        return Response.json({ ok: true, results: await runIndicatorInsightAll() });
      },
    },
  },
});
