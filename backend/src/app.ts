import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { Receipt } from './agents/receipt.ts';

const app = new Hono();

// Step 1 (local agent check only). Step 2 adds, BEFORE this mount: CORS, token auth,
// conversation-id ownership (server-issued ids, strict regex, default deny), and caps.
// The agent router has no auth of its own:
// https://flueframework.com/docs/guide/routing/#protecting-your-agents
app.route('/agents/receipt', createAgentRouter(Receipt));

export default app;
