import { createAgentRouter } from '@flue/runtime/routing';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import * as v from 'valibot';
import { Receipt } from './agents/receipt.ts';
import { bearerToken, formatInviteCode, ipScope, normalizeInviteCode } from './lib/auth.ts';
import { entriesToCsv } from './lib/csv.ts';
import { consumeAnalysis, consumeJoin, readLimits, remainingAnalyses } from './lib/limits.ts';
import {
	claimConversation,
	conversationClub,
	createClub,
	createConversation,
	deleteEntry,
	entryByKey,
	exportEntries,
	findSameDayAmount,
	joinClub,
	listEntries,
	type Member,
	memberByToken,
	saveEntry,
} from './lib/store.ts';
import {
	CONVERSATION_ID_RE,
	CreateClubBody,
	EntryBody,
	IdempotencyKey,
	JoinBody,
	kstToday,
	Month,
} from './shared/schema.ts';

type AppEnv = { Bindings: Env; Variables: { member: Member } };

const app = new Hono<AppEnv>();

const AGENT_MOUNT = '/agents/receipt';
/** Message POST body cap: a 1600px JPEG as base64 fits easily; blocks oversized direct calls. */
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;

// 1) CORS first, so 401/403/429 responses also carry CORS headers.
// Exact-match origin only; empty WEB_ORIGIN allows no cross-origin caller (never '*').
// https://hono.dev/docs/middleware/builtin/cors
// Expose Flue's stream coordination headers: https://flueframework.com/docs/guide/routing/#cors
app.use(
	'*',
	cors({
		origin: (origin, c: Context<AppEnv>) => (c.env.WEB_ORIGIN && origin === c.env.WEB_ORIGIN ? origin : null),
		allowMethods: ['GET', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
		allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
		exposeHeaders: ['Stream-Next-Offset', 'Stream-Up-To-Date', 'Location'],
		maxAge: 600,
	}),
);

const err = (c: Context, status: 400 | 401 | 403 | 404 | 409 | 411 | 413 | 429, error: string, extra?: object) =>
	c.json({ error, ...extra }, status);

async function readJson<T extends v.GenericSchema>(c: Context, schema: T): Promise<v.InferOutput<T> | null> {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return null;
	}
	const parsed = v.safeParse(schema, body);
	return parsed.success ? parsed.output : null;
}

/** Bearer token -> member. Sets `c.var.member`. */
const requireMember: MiddlewareHandler<AppEnv> = async (c, next) => {
	const token = bearerToken(c.req.header('Authorization'));
	const member = token ? await memberByToken(c.env.DB, token) : null;
	if (!member) return err(c, 401, 'unauthorized');
	c.set('member', member);
	await next();
};

// ---- Public: create / join -------------------------------------------------

app.post('/api/clubs', async (c) => {
	const body = await readJson(c, CreateClubBody);
	if (!body) return err(c, 400, 'invalid_body');
	if (!(await consumeJoin(c.env.DB, readLimits(c.env), await ipScope('join-ip', c.req.raw)))) {
		return err(c, 429, 'daily_limit', { scope: 'join-ip' });
	}
	const s = await createClub(c.env.DB, body.name, body.treasurerName);
	return c.json(
		{ clubId: s.clubId, clubName: s.clubName, inviteCode: s.inviteCode, token: s.token, role: s.role, name: s.name },
		201,
	);
});

app.post('/api/join', async (c) => {
	const body = await readJson(c, JoinBody);
	if (!body) return err(c, 400, 'invalid_body');
	// Count before lookup so invite-code guessing is rate limited too.
	if (!(await consumeJoin(c.env.DB, readLimits(c.env), await ipScope('join-ip', c.req.raw)))) {
		return err(c, 429, 'daily_limit', { scope: 'join-ip' });
	}
	const code = normalizeInviteCode(body.inviteCode);
	const s = code ? await joinClub(c.env.DB, code, body.name) : null;
	if (!s) return err(c, 404, 'invite_not_found');
	return c.json({ clubId: s.clubId, clubName: s.clubName, token: s.token, role: s.role, name: s.name }, 201);
});

// ---- Members ---------------------------------------------------------------

app.get('/api/me', requireMember, async (c) => {
	const m = c.var.member;
	const remaining = await remainingAnalyses(c.env.DB, readLimits(c.env), {
		clubId: m.clubId,
		ipScope: await ipScope('ip', c.req.raw),
	});
	return c.json({
		member: { id: m.id, name: m.name, role: m.role },
		club: {
			id: m.clubId,
			name: m.clubName,
			...(m.role === 'treasurer' ? { inviteCode: formatInviteCode(m.inviteCode) } : {}),
		},
		remainingAnalyses: remaining,
	});
});

/** One server-issued conversation per receipt. */
app.post('/api/conversations', requireMember, async (c) => {
	const m = c.var.member;
	const remaining = await remainingAnalyses(c.env.DB, readLimits(c.env), {
		clubId: m.clubId,
		ipScope: await ipScope('ip', c.req.raw),
	});
	if (remaining <= 0) return err(c, 429, 'daily_limit');
	return c.json({ conversationId: await createConversation(c.env.DB, m) }, 201);
});

// ---- Ledger ----------------------------------------------------------------
// Club comes from the token only — never from the path or body.

app.post('/api/entries', requireMember, async (c) => {
	const m = c.var.member;
	const key = v.safeParse(IdempotencyKey, c.req.header('Idempotency-Key') ?? '');
	if (!key.success) return err(c, 400, 'invalid_idempotency_key');
	const body = await readJson(c, EntryBody);
	if (!body) return err(c, 400, 'invalid_body');
	const conversationId = body.conversationId ?? null;
	if (conversationId && (await conversationClub(c.env.DB, conversationId)) !== m.clubId) {
		return err(c, 400, 'invalid_conversation');
	}
	// A retry of an already-saved draft returns that row (it would otherwise match itself below).
	const existing = await entryByKey(c.env.DB, m.clubId, key.output);
	if (existing) return c.json({ entry: existing, created: false, similar: [] }, 200);

	// Same receipt uploaded twice: same date + amount + time (minute), or time unknown on
	// either side. Warn instead of blocking; the user may confirm with allowDuplicate.
	const { duplicates, similar } = await findSameDayAmount(c.env.DB, m.clubId, body.date, body.amount, body.time);
	if (duplicates.length > 0 && !body.allowDuplicate) {
		return err(c, 409, 'possible_duplicate', { duplicates });
	}

	const { entry, created } = await saveEntry(c.env.DB, m, key.output, {
		date: body.date,
		time: body.time,
		merchant: body.merchant,
		amount: body.amount,
		category: body.category,
		reason: body.reason,
		memo: body.memo,
		conversationId,
	});
	// `similar`: same date + amount but a different time — saved, shown as a soft notice.
	return c.json({ entry, created, similar }, created ? 201 : 200);
});

app.get('/api/entries', requireMember, async (c) => {
	const q = c.req.query('month');
	const month = q === undefined ? kstToday().slice(0, 7) : v.safeParse(Month, q);
	if (typeof month !== 'string' && !month.success) return err(c, 400, 'invalid_month');
	const value = typeof month === 'string' ? month : month.output;
	return c.json({ month: value, ...(await listEntries(c.env.DB, c.var.member.clubId, value)) });
});

/** CSV download. `?month=YYYY-MM` for one month; omit for all entries. */
app.get('/api/entries.csv', requireMember, async (c) => {
	const q = c.req.query('month');
	const month = q === undefined ? null : v.safeParse(Month, q);
	if (month !== null && !month.success) return err(c, 400, 'invalid_month');
	const value = month === null ? null : month.output;
	const csv = entriesToCsv(await exportEntries(c.env.DB, c.var.member.clubId, value));
	return c.body(csv, 200, {
		'Content-Type': 'text/csv; charset=utf-8',
		'Content-Disposition': `attachment; filename="club-treasurer-${value ?? 'all'}.csv"`,
		'Cache-Control': 'no-store',
	});
});

app.delete('/api/entries/:id', requireMember, async (c) => {
	const m = c.var.member;
	if (m.role !== 'treasurer') return err(c, 403, 'treasurer_only');
	const id = v.safeParse(v.pipe(v.string(), v.uuid()), c.req.param('id'));
	if (!id.success || !(await deleteEntry(c.env.DB, m.clubId, id.output))) return err(c, 404, 'not_found');
	return c.body(null, 204);
});

// ---- Agent gate (default deny) ---------------------------------------------
// The Flue agent router has no auth: https://flueframework.com/docs/guide/routing/#protecting-your-agents
// Its routes (verified in createAgentRouter): POST/GET/HEAD /:id, POST /:id/abort,
// GET /:id/attachments/:attachmentId. Anything else is 404 here.

app.use(`${AGENT_MOUNT}/*`, async (c, next) => {
	// Raw (undecoded) path: reject any percent-encoding so our id check and Flue's
	// decoded `c.req.param('id')` can never disagree.
	const raw = new URL(c.req.url).pathname;
	if (raw.includes('%')) return err(c, 404, 'not_found');
	const parts = raw.slice(AGENT_MOUNT.length + 1).split('/');
	const [id, sub, attachmentId, ...rest] = parts;
	const method = c.req.method;
	const allowed =
		rest.length === 0 &&
		CONVERSATION_ID_RE.test(id ?? '') &&
		((sub === undefined && attachmentId === undefined && ['GET', 'HEAD', 'POST'].includes(method)) ||
			(sub === 'abort' && attachmentId === undefined && method === 'POST') ||
			(sub === 'attachments' && !!attachmentId && method === 'GET'));
	if (!allowed) return err(c, 404, 'not_found');

	const token = bearerToken(c.req.header('Authorization'));
	const member = token ? await memberByToken(c.env.DB, token) : null;
	if (!member) return err(c, 401, 'unauthorized');

	const clubId = await conversationClub(c.env.DB, id);
	if (!clubId || clubId !== member.clubId) return err(c, 403, 'forbidden');

	// Message delivery: one per conversation, size-capped, counted against daily caps.
	if (method === 'POST' && sub === undefined) {
		const len = Number(c.req.header('Content-Length') ?? Number.NaN);
		if (!Number.isFinite(len)) return err(c, 411, 'length_required');
		if (len > MAX_MESSAGE_BYTES) return err(c, 413, 'too_large');
		if (!(await claimConversation(c.env.DB, id))) return err(c, 409, 'conversation_used');
		const exceeded = await consumeAnalysis(c.env.DB, readLimits(c.env), {
			clubId: member.clubId,
			ipScope: await ipScope('ip', c.req.raw),
		});
		if (exceeded) return err(c, 429, 'daily_limit', { scope: exceeded });
	}
	await next();
});

app.route(AGENT_MOUNT, createAgentRouter(Receipt));

app.notFound((c) => c.json({ error: 'not_found' }, 404));

export default app;
