import type { Role, Session } from './session.ts';

export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:5173').replace(/\/+$/, '');

/** Mirrors the backend list (backend/src/shared/schema.ts). */
export const CATEGORIES = [
	'시설 대관료',
	'장비·용품',
	'행사비',
	'모임 간식·회식비',
	'대회 참가비',
	'운영비',
	'기타',
] as const;
export const CATEGORY_NEEDS_REVIEW = '분류 확인 필요';

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	constructor(status: number, code: string) {
		super(code);
		this.status = status;
		this.code = code;
	}
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
	const headers = new Headers(init.headers);
	if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
	if (init.body) headers.set('Content-Type', 'application/json');
	let res: Response;
	try {
		res = await fetch(`${API_ORIGIN}${path}`, { ...init, headers });
	} catch {
		throw new ApiError(0, 'network');
	}
	if (res.status === 204) return undefined as T;
	const body = (await res.json().catch(() => ({}))) as { error?: unknown };
	if (!res.ok) throw new ApiError(res.status, typeof body.error === 'string' ? body.error : 'error');
	return body as T;
}

export interface SessionResponse {
	clubId: string;
	clubName: string;
	token: string;
	role: Role;
	name: string;
	inviteCode?: string;
}

export function createClub(name: string, treasurerName: string) {
	return request<SessionResponse>('/api/clubs', { method: 'POST', body: JSON.stringify({ name, treasurerName }) });
}

export function joinClub(inviteCode: string, name: string) {
	return request<SessionResponse>('/api/join', { method: 'POST', body: JSON.stringify({ inviteCode, name }) });
}

export interface Me {
	member: { id: string; name: string; role: Role };
	club: { id: string; name: string; inviteCode?: string };
	remainingAnalyses: number;
}

export function getMe(s: Session) {
	return request<Me>('/api/me', { token: s.token });
}

export function newConversation(s: Session) {
	return request<{ conversationId: string }>('/api/conversations', { method: 'POST', token: s.token });
}

export function agentUrl(conversationId: string) {
	return `${API_ORIGIN}/agents/receipt/${conversationId}`;
}

export interface EntryInput {
	date: string;
	merchant: string;
	amount: number;
	category: string;
	reason?: string;
	memo?: string;
	conversationId?: string | null;
}

export interface Entry extends Required<Omit<EntryInput, 'conversationId'>> {
	id: string;
	savedBy: { id: string; name: string };
	conversationId: string | null;
	createdAt: string;
}

export function saveEntry(s: Session, idempotencyKey: string, entry: EntryInput) {
	return request<{ entry: Entry; created: boolean }>('/api/entries', {
		method: 'POST',
		token: s.token,
		headers: { 'Idempotency-Key': idempotencyKey },
		body: JSON.stringify(entry),
	});
}

export interface Ledger {
	month: string;
	entries: Entry[];
	total: number;
	byCategory: { category: string; amount: number; count: number }[];
	months: string[];
}

export function listEntries(s: Session, month?: string) {
	return request<Ledger>(`/api/entries${month ? `?month=${encodeURIComponent(month)}` : ''}`, { token: s.token });
}

/** Fetches the CSV with the bearer token and saves it (a plain link can't send Authorization). */
export async function downloadCsv(s: Session, month?: string): Promise<void> {
	let res: Response;
	try {
		res = await fetch(`${API_ORIGIN}/api/entries.csv${month ? `?month=${encodeURIComponent(month)}` : ''}`, {
			headers: { Authorization: `Bearer ${s.token}` },
		});
	} catch {
		throw new ApiError(0, 'network');
	}
	if (!res.ok) throw new ApiError(res.status, 'error');
	const url = URL.createObjectURL(await res.blob());
	const a = document.createElement('a');
	a.href = url;
	a.download = `${s.clubName.replace(/[\\/:*?"<>|]/g, '_')}-장부-${month ?? '전체'}.csv`;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function deleteEntry(s: Session, id: string) {
	return request<void>(`/api/entries/${encodeURIComponent(id)}`, { method: 'DELETE', token: s.token });
}

export function won(amount: number): string {
	return `${amount.toLocaleString('ko-KR')}원`;
}

/** User-facing Korean message for an API failure (never raw server text). */
export function errorMessage(e: unknown): string {
	if (!(e instanceof ApiError)) return '문제가 생겼습니다. 잠시 후 다시 시도해 주세요.';
	switch (e.code) {
		case 'network':
			return '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.';
		case 'daily_limit':
			return '오늘 분석 한도에 도달했습니다. 내일 다시 시도하거나 직접 입력해 주세요.';
		case 'invite_not_found':
			return '초대 코드를 찾지 못했습니다. 코드를 다시 확인해 주세요.';
		case 'invalid_body':
			return '입력값을 확인해 주세요.';
		case 'unauthorized':
			return '다시 입장해 주세요.';
		case 'treasurer_only':
			return '재무 이사만 할 수 있습니다.';
		default:
			return '문제가 생겼습니다. 잠시 후 다시 시도해 주세요.';
	}
}
