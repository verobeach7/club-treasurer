// Daily caps on receipt analysis (paid model calls) and on club create/join.
// Counters live in D1 `usage_daily`, keyed by KST day.

export interface Limits {
	club: number;
	ip: number;
	global: number;
	joinIp: number;
}

function intVar(value: string | undefined, fallback: number): number {
	const n = Number.parseInt(value ?? '', 10);
	return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function readLimits(env: Env): Limits {
	return {
		club: intVar(env.CLUB_DAILY_LIMIT, 20),
		ip: intVar(env.IP_DAILY_LIMIT, 15),
		global: intVar(env.GLOBAL_DAILY_LIMIT, 100),
		joinIp: intVar(env.JOIN_IP_DAILY_LIMIT, 20),
	};
}

export function kstDay(now = Date.now()): string {
	return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const UPSERT = `INSERT INTO usage_daily (day, scope, count) VALUES (?, ?, 1)
	ON CONFLICT (day, scope) DO UPDATE SET count = count + 1
	RETURNING count`;

export type LimitScope = 'club' | 'ip' | 'global' | 'join-ip';

/**
 * Counts one analysis against club, IP, and global caps in one D1 batch (one transaction).
 * Fail-closed: the attempt is counted even if it is then rejected or later fails.
 * Returns the first exceeded scope, or null when allowed.
 */
export async function consumeAnalysis(
	db: D1Database,
	limits: Limits,
	scopes: { clubId: string; ipScope: string },
): Promise<LimitScope | null> {
	const day = kstDay();
	const [club, ip, global] = await db.batch<{ count: number }>([
		db.prepare(UPSERT).bind(day, scopes.clubId),
		db.prepare(UPSERT).bind(day, scopes.ipScope),
		db.prepare(UPSERT).bind(day, 'global'),
	]);
	if ((club.results[0]?.count ?? Infinity) > limits.club) return 'club';
	if ((ip.results[0]?.count ?? Infinity) > limits.ip) return 'ip';
	if ((global.results[0]?.count ?? Infinity) > limits.global) return 'global';
	return null;
}

/** Counts one club-create/join attempt per IP. true = allowed. */
export async function consumeJoin(db: D1Database, limits: Limits, joinIpScope: string): Promise<boolean> {
	const row = await db.prepare(UPSERT).bind(kstDay(), joinIpScope).first<{ count: number }>();
	return (row?.count ?? Infinity) <= limits.joinIp;
}

/** Analyses left today for this caller: the tightest of the three caps. */
export async function remainingAnalyses(
	db: D1Database,
	limits: Limits,
	scopes: { clubId: string; ipScope: string },
): Promise<number> {
	const { results } = await db
		.prepare('SELECT scope, count FROM usage_daily WHERE day = ? AND scope IN (?, ?, ?)')
		.bind(kstDay(), scopes.clubId, scopes.ipScope, 'global')
		.all<{ scope: string; count: number }>();
	const used = (scope: string) => results.find((r) => r.scope === scope)?.count ?? 0;
	return Math.max(
		0,
		Math.min(
			limits.club - used(scopes.clubId),
			limits.ip - used(scopes.ipScope),
			limits.global - used('global'),
		),
	);
}
