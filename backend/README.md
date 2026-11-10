# backend

Flue + Hono API Worker for Club Treasurer. See the [root README](../README.md).

- `src/app.ts` — route map: CORS → `/api/*` → agent gate → `/agents/receipt`
- `src/agents/receipt.ts` — Receipt agent (`propose_entry` tool)
- `src/lib/` — auth (tokens, invite codes), store (D1), limits (daily caps)
- `src/shared/schema.ts` — categories and Valibot schemas
- `migrations/` — D1 schema

```sh
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply club-treasurer --local
npm run dev           # http://localhost:5173
npm run check:types
npm run deploy
```
