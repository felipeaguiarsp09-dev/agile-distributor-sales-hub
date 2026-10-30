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
- Orders list scroll restoration is keyed by validated filters and page; other routes retain history-entry keys. Why: both the detail return link and browser Back restore the same list without mixing filter contexts.
- Dashboard subscribes once per mounted identity to RLS-scoped order changes and invalidates that user's metric/coverage caches; active month/seller queries refetch and inactive ones become stale. Why: live approvals and invoicing stay consistent without replacing authenticated reads or resetting filters.
- Customer and visit goals are nullable monthly sales-target fields managed on /metas; coverage and visit metrics extend the existing RLS-invoker dashboard RPC. Why: preserves the first-read flow, existing monetary goals and seller isolation.
- Order quantity buttons share one control and functional cart updates; client history uses a paginated rolling calendar-month window. Why: consistent fast editing and complete permission-scoped history.
- Order creation autosaves a draft in the browser (debounced upsert reusing the same draft row); the DB trigger computes totals, so the client never writes total_amount/status/needs_approval. Why: carts survive navigation without bypassing protect_order_fields.
- Dashboard metric reads use an authenticated server function with the verified request client and user-scoped cache keys; initial failures surface without automatic retries so session transitions cannot be masked by a second request.
- Do not implement email reauthentication as a mandatory recovery security boundary using only a UI gate or updateUser nonce; Cloud Auth skips nonce validation for recent sessions. Why: recovery creates a recent session and direct password updates could bypass the code.
- The package docs (SKILL.md, db/schemas.sql, docs/*) are the spec; the database schema mirrors db/schemas.sql plus table GRANTs. Why: the user treats them as the single source of truth.
- Roles live in `profiles.role` (per spec); a trigger blocks non-admins from changing role/org/supervisor/is_active. Why: prevents self-promotion while keeping the spec's schema.
- New auth users get a profile via the `handle_new_user` trigger (first user = administrador, others = vendedor). Why: profiles require an organization and only admins may insert them.
- Server-side integrations use TanStack server functions/routes instead of Supabase Edge Functions. Why: platform stack; spec names are kept as function/route names.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate, sidebar shell); menu items come from `src/lib/modules.ts` filtered by role.
- Payment webhooks (`/api/public/payment-webhook`) never trust the request body: they re-fetch the payment from the gateway (or check the Asaas token) using credentials in `integration_configs`. Why: the route is public.
- Scheduled jobs are server routes under `src/routes/api/public/jobs/*` guarded by `authenticateCronRequest`, with logic in `src/lib/jobs.server.ts`. Why: managed HTTP schedules, no Edge Functions.
