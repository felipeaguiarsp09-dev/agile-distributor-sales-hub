<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Do not implement email reauthentication as a mandatory recovery security boundary using only a UI gate or updateUser nonce; Cloud Auth skips nonce validation for recent sessions. Why: recovery creates a recent session and direct password updates could bypass the code.
- The package docs (SKILL.md, db/schemas.sql, docs/*) are the spec; the database schema mirrors db/schemas.sql plus table GRANTs. Why: the user treats them as the single source of truth.
- Roles live in `profiles.role` (per spec); a trigger blocks non-admins from changing role/org/supervisor/is_active. Why: prevents self-promotion while keeping the spec's schema.
- New auth users get a profile via the `handle_new_user` trigger (first user = administrador, others = vendedor). Why: profiles require an organization and only admins may insert them.
- Server-side integrations use TanStack server functions/routes instead of Supabase Edge Functions. Why: platform stack; spec names are kept as function/route names.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate, sidebar shell); menu items come from `src/lib/modules.ts` filtered by role.
- Payment webhooks (`/api/public/payment-webhook`) never trust the request body: they re-fetch the payment from the gateway (or check the Asaas token) using credentials in `integration_configs`. Why: the route is public.
- Scheduled jobs are server routes under `src/routes/api/public/jobs/*` guarded by `authenticateCronRequest`, with logic in `src/lib/jobs.server.ts`. Why: managed HTTP schedules, no Edge Functions.
