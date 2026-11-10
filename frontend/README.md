# frontend

React 19 + Tailwind v4 SPA for Club Treasurer, served as a Cloudflare Worker with static assets. See the [root README](../README.md).

- `src/pages/` — Home (create/join), Club (upload → draft → save), Ledger
- `src/components/ReceiptSession.tsx` — `useFlueAgent` + `createFlueClient({ token })` for one receipt conversation
- `src/lib/api.ts` — backend calls; `VITE_API_ORIGIN` (`.env.production`) or `http://localhost:5173` in dev

```sh
npm install
npm run dev      # http://localhost:5174 (backend must allow this origin)
npm run build
npm run deploy
```
