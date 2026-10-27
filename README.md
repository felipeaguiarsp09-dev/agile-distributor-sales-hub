# APP Força de Vendas

Estamos construindo o "App de Força de Vendas para Distribuidoras". Leia primeiro o SKILL.md e depois o README.md — eles explicam o pacote. O banco é criado rodando db/schemas.sql no Supabase. Comece pela fase 1 do docs/PLANO.md e me avise ao concluir cada tarefa.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://agile-distributor-sales-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c137ff7e-6ebf-4f9a-b1e2-31b071e8d195).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js 20+ and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

O app sobe em http://localhost:8080 e já aponta para o backend do Lovable Cloud via `.env` (variáveis `VITE_SUPABASE_*`). Sem o `.env`, o login não funciona.

Outros comandos:

```sh
npm test          # testes (vitest run)
npm run test:watch
npm run lint
npm run build     # build de produção
npm run preview   # serve o build localmente
```

Observações:
- O lockfile do projeto é `bun.lock`; com npm ele é ignorado e o npm gera um `package-lock.json` próprio — as versões podem variar levemente. Para reproduzir exatamente o ambiente do Lovable, use `bun install`.
- As rotas de tarefas agendadas (`/api/public/jobs/*`) exigem a variável `LOVABLE_CRON_SECRET` no ambiente; sem ela, respondem 401 localmente.
- Os webhooks de pagamento e as tarefas agendadas só disparam no ambiente publicado.
