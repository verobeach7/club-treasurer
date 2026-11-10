// Token, invite-code, and hashing helpers (Web Crypto, available in Workers).
// https://developers.cloudflare.com/workers/runtime-apis/web-crypto/

/** Crockford-style base32 without I, O, 0, 1 (easy to read aloud and type). 32 symbols. */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 12; // 12 × 5 bits = 60 bits

function bytesToHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(input: string): Promise<string> {
	return bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}

/** 32 random bytes; only the SHA-256 hash is stored. */
export function newToken(): string {
	return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** Normalized (no hyphens). 256 % 32 === 0, so `byte & 31` is unbiased. */
export function newInviteCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(INVITE_LENGTH));
	return [...bytes].map((b) => INVITE_ALPHABET[b & 31]).join('');
}

/** `XXXX-XXXX-XXXX` for display. */
export function formatInviteCode(code: string): string {
	return code.match(/.{1,4}/g)?.join('-') ?? code;
}

/** Ignores case, spaces, and hyphens. Returns null when it can't be a valid code. */
export function normalizeInviteCode(input: string): string | null {
	const code = input.toUpperCase().replace(/[\s-]/g, '');
	if (code.length !== INVITE_LENGTH) return null;
	for (const ch of code) if (!INVITE_ALPHABET.includes(ch)) return null;
	return code;
}

/** `Authorization: Bearer <token>` (what `createFlueClient({ token })` sends). */
export function bearerToken(header: string | undefined): string | null {
	const m = header?.match(/^Bearer ([A-Za-z0-9_-]{20,100})$/);
	return m ? m[1] : null;
}

/** Hashed client IP for usage counters; raw IPs are never stored. */
export async function ipScope(prefix: 'ip' | 'join-ip', req: Request): Promise<string> {
	const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
	return `${prefix}:${(await sha256Hex(`club-treasurer:${ip}`)).slice(0, 32)}`;
}
