// D1 queries. (Not named `db.ts`: Flue's Cloudflare build rejects a source-root db.ts.)
// D1 API: https://developers.cloudflare.com/d1/worker-api/
import { formatInviteCode, newInviteCode, newToken, sha256Hex } from './auth.ts';

export type Role = 'treasurer' | 'member';

export interface Member {
	id: string;
	clubId: string;
	clubName: string;
	name: string;
	role: Role;
	inviteCode: string; // normalized
}

export interface Session {
	clubId: string;
	clubName: string;
	memberId: string;
	name: string;
	role: Role;
	token: string;
	inviteCode?: string; // formatted, treasurer only
}

export async function memberByToken(db: D1Database, token: string): Promise<Member | null> {
	const row = await db
		.prepare(
			`SELECT m.id, m.club_id, m.name, m.role, c.name AS club_name, c.invite_code
			 FROM members m JOIN clubs c ON c.id = m.club_id
			 WHERE m.token_hash = ? LIMIT 1`,
		)
		.bind(await sha256Hex(token))
		.first<{ id: string; club_id: string; name: string; role: Role; club_name: string; invite_code: string }>();
	if (!row) return null;
	return {
		id: row.id,
		clubId: row.club_id,
		clubName: row.club_name,
		name: row.name,
		role: row.role,
		inviteCode: row.invite_code,
	};
}

function insertMember(db: D1Database, m: { id: string; clubId: string; name: string; role: Role; tokenHash: string }) {
	return db
		.prepare('INSERT INTO members (id, club_id, name, role, token_hash) VALUES (?, ?, ?, ?, ?)')
		.bind(m.id, m.clubId, m.name, m.role, m.tokenHash);
}

/** Creates a club and its treasurer atomically (D1 batch = one transaction). */
export async function createClub(db: D1Database, clubName: string, treasurerName: string): Promise<Session> {
	const clubId = crypto.randomUUID();
	const memberId = crypto.randomUUID();
	const token = newToken();
	const tokenHash = await sha256Hex(token);
	// Retry on the (astronomically unlikely) invite-code collision.
	for (let attempt = 0; ; attempt++) {
		const inviteCode = newInviteCode();
		try {
			await db.batch([
				db.prepare('INSERT INTO clubs (id, name, invite_code) VALUES (?, ?, ?)').bind(clubId, clubName, inviteCode),
				insertMember(db, { id: memberId, clubId, name: treasurerName, role: 'treasurer', tokenHash }),
			]);
			return {
				clubId,
				clubName,
				memberId,
				name: treasurerName,
				role: 'treasurer',
				token,
				inviteCode: formatInviteCode(inviteCode),
			};
		} catch (err) {
			if (attempt >= 2 || !String(err).includes('UNIQUE')) throw err;
		}
	}
}

/** Joins by normalized invite code. Returns null when no club matches. */
export async function joinClub(db: D1Database, inviteCode: string, name: string): Promise<Session | null> {
	const club = await db
		.prepare('SELECT id, name FROM clubs WHERE invite_code = ? LIMIT 1')
		.bind(inviteCode)
		.first<{ id: string; name: string }>();
	if (!club) return null;
	const memberId = crypto.randomUUID();
	const token = newToken();
	await insertMember(db, { id: memberId, clubId: club.id, name, role: 'member', tokenHash: await sha256Hex(token) }).run();
	return { clubId: club.id, clubName: club.name, memberId, name, role: 'member', token };
}

export async function createConversation(db: D1Database, member: Member): Promise<string> {
	const id = `${member.clubId}--${crypto.randomUUID()}`;
	await db
		.prepare('INSERT INTO conversations (id, club_id, created_by) VALUES (?, ?, ?)')
		.bind(id, member.clubId, member.id)
		.run();
	return id;
}

export async function conversationClub(db: D1Database, id: string): Promise<string | null> {
	return db.prepare('SELECT club_id FROM conversations WHERE id = ? LIMIT 1').bind(id).first<string>('club_id');
}

// ---- Ledger entries ----------------------------------------------------------

export interface Entry {
	id: string;
	date: string;
	merchant: string;
	amount: number;
	category: string;
	reason: string;
	memo: string;
	savedBy: { id: string; name: string };
	conversationId: string | null;
	createdAt: string;
}

const ENTRY_SELECT = `SELECT e.id, e.date, e.merchant, e.amount, e.category, e.reason, e.memo,
	e.saved_by, m.name AS saved_by_name, e.conversation_id, e.created_at
	FROM entries e JOIN members m ON m.id = e.saved_by`;

type EntryRow = {
	id: string;
	date: string;
	merchant: string;
	amount: number;
	category: string;
	reason: string;
	memo: string;
	saved_by: string;
	saved_by_name: string;
	conversation_id: string | null;
	created_at: string;
};

function toEntry(r: EntryRow): Entry {
	return {
		id: r.id,
		date: r.date,
		merchant: r.merchant,
		amount: r.amount,
		category: r.category,
		reason: r.reason,
		memo: r.memo,
		savedBy: { id: r.saved_by, name: r.saved_by_name },
		conversationId: r.conversation_id,
		createdAt: r.created_at,
	};
}

/**
 * Idempotent save: the same (club, Idempotency-Key) yields one row. `created` is false
 * when the key was already used, and the existing row (same club only) is returned.
 */
export async function saveEntry(
	db: D1Database,
	member: Member,
	key: string,
	e: { date: string; merchant: string; amount: number; category: string; reason: string; memo: string; conversationId: string | null },
): Promise<{ entry: Entry; created: boolean }> {
	const inserted = await db
		.prepare(
			`INSERT INTO entries (id, club_id, idempotency_key, date, merchant, amount, category, reason, memo, saved_by, conversation_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (club_id, idempotency_key) DO NOTHING
			 RETURNING id`,
		)
		.bind(crypto.randomUUID(), member.clubId, key, e.date, e.merchant, e.amount, e.category, e.reason, e.memo, member.id, e.conversationId)
		.first<{ id: string }>();
	const row = await db
		.prepare(`${ENTRY_SELECT} WHERE e.club_id = ? AND e.idempotency_key = ? LIMIT 1`)
		.bind(member.clubId, key)
		.first<EntryRow>();
	if (!row) throw new Error('entry missing after insert');
	return { entry: toEntry(row), created: inserted !== null };
}

export async function listEntries(
	db: D1Database,
	clubId: string,
	month: string,
): Promise<{ entries: Entry[]; total: number; byCategory: { category: string; amount: number; count: number }[]; months: string[] }> {
	const [list, months] = await db.batch([
		db.prepare(`${ENTRY_SELECT} WHERE e.club_id = ? AND substr(e.date, 1, 7) = ? ORDER BY e.date DESC, e.created_at DESC`).bind(clubId, month),
		db.prepare('SELECT DISTINCT substr(date, 1, 7) AS month FROM entries WHERE club_id = ? ORDER BY month DESC').bind(clubId),
	]);
	const entries = (list.results as EntryRow[]).map(toEntry);
	const totals = new Map<string, { amount: number; count: number }>();
	for (const e of entries) {
		const t = totals.get(e.category) ?? { amount: 0, count: 0 };
		t.amount += e.amount;
		t.count += 1;
		totals.set(e.category, t);
	}
	return {
		entries,
		total: entries.reduce((sum, e) => sum + e.amount, 0),
		byCategory: [...totals].map(([category, t]) => ({ category, ...t })).sort((a, b) => b.amount - a.amount),
		months: (months.results as { month: string }[]).map((r) => r.month),
	};
}

/** Deletes only within the caller's club. false = no such entry there. */
export async function deleteEntry(db: D1Database, clubId: string, id: string): Promise<boolean> {
	const res = await db.prepare('DELETE FROM entries WHERE id = ? AND club_id = ?').bind(id, clubId).run();
	return res.meta.changes === 1;
}

/** Atomically claims the single allowed message POST. false = already used. */
export async function claimConversation(db: D1Database, id: string): Promise<boolean> {
	const res = await db.prepare('UPDATE conversations SET used = 1 WHERE id = ? AND used = 0').bind(id).run();
	return res.meta.changes === 1;
}
