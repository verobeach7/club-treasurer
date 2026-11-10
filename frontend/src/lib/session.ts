// The member's bearer token lives in localStorage (no login in the MVP).
// Storage can be unavailable (private mode, blocked site data): every access is guarded.

export type Role = 'treasurer' | 'member';

export interface Session {
	token: string;
	clubId: string;
	clubName: string;
	name: string;
	role: Role;
}

const KEY = 'club-treasurer.session.v1';

export function loadSession(): Session | null {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const s = JSON.parse(raw) as Partial<Session>;
		if (typeof s.token !== 'string' || typeof s.clubId !== 'string') return null;
		return {
			token: s.token,
			clubId: s.clubId,
			clubName: String(s.clubName ?? ''),
			name: String(s.name ?? ''),
			role: s.role === 'treasurer' ? 'treasurer' : 'member',
		};
	} catch {
		return null;
	}
}

export function saveSession(s: Session): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(s));
	} catch {
		// Works for this tab only; the user re-joins next time.
	}
}

export function clearSession(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}
