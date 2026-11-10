import * as v from 'valibot';

/** Ledger categories. The 2027 club list replaces this in November. */
export const CATEGORIES = [
	'시설 대관료',
	'장비·용품',
	'행사비',
	'모임 간식·회식비',
	'대회 참가비',
	'운영비',
	'기타',
] as const;

/** Used when no category fits; the treasurer must pick one before saving. */
export const CATEGORY_NEEDS_REVIEW = '분류 확인 필요' as const;

export const ALL_CATEGORIES = [...CATEGORIES, CATEGORY_NEEDS_REVIEW] as const;

export const REVIEW_FIELDS = ['date', 'time', 'merchant', 'amount', 'category'] as const;

/** HH:MM or HH:MM:SS (24h). */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Conversation id: `${clubId}--${uuid}`, both server-issued UUIDs. */
export const CONVERSATION_ID_RE = /^[0-9a-f-]{36}--[0-9a-f-]{36}$/;

/**
 * What the Receipt agent proposes via `propose_entry`. Model output is untrusted:
 * this only shapes the draft card; `POST /api/entries` re-validates before saving.
 */
export const ReceiptProposal = v.object({
	isReceipt: v.pipe(v.boolean(), v.description('사진이 영수증(카드 전표 포함)이면 true, 아니면 false.')),
	date: v.pipe(
		v.nullable(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/))),
		v.description('결제 날짜 YYYY-MM-DD. 읽을 수 없으면 null.'),
	),
	time: v.pipe(
		v.nullable(v.pipe(v.string(), v.regex(TIME_RE))),
		v.description('결제 시각 HH:MM 또는 HH:MM:SS(24시간제). 영수증에 없거나 읽을 수 없으면 null.'),
	),
	merchant: v.pipe(
		v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(100))),
		v.description('상호명(가게 이름). 읽을 수 없으면 null.'),
	),
	amount: v.pipe(
		v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100_000_000))),
		v.description('결제 총액(원, 정수, 쉼표 없이). 읽을 수 없으면 null.'),
	),
	category: v.pipe(v.picklist(ALL_CATEGORIES), v.description('분류 목록 중 하나.')),
	reason: v.pipe(
		v.string(),
		v.maxLength(300),
		v.description('분류와 값의 근거를 한국어 한두 문장으로.'),
	),
	needsReview: v.pipe(
		v.array(v.picklist(REVIEW_FIELDS)),
		v.description('확실하지 않거나 읽지 못한 항목 이름 목록.'),
	),
});

export type ReceiptProposal = v.InferOutput<typeof ReceiptProposal>;

/** Trimmed, no control characters, length-bounded display text. */
const displayText = (min: number, max: number) =>
	v.pipe(v.string(), v.trim(), v.minLength(min), v.maxLength(max), v.regex(/^[^\p{Cc}\p{Cf}]*$/u));

export const MemberName = displayText(1, 30);
export const ClubName = displayText(1, 50);

export const CreateClubBody = v.object({ name: ClubName, treasurerName: MemberName });

/** Today in KST as YYYY-MM-DD. */
export function kstToday(now = Date.now()): string {
	return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Real calendar date (v.isoDate accepts 2025-02-29), between 2020-01-01 and KST today + 1 day. */
export const EntryDate = v.pipe(
	v.string(),
	v.isoDate(),
	v.check((d) => new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d, 'invalid_date'),
	v.check((d) => d >= '2020-01-01', 'date_too_old'),
	v.check((d) => d <= kstToday(Date.now() + 24 * 60 * 60 * 1000), 'date_in_future'),
);

/** Body of `POST /api/entries`. The human-confirmed values; model output is never trusted directly. */
export const EntryBody = v.object({
	date: EntryDate,
	// Stored as HH:MM (seconds dropped): duplicate checks compare to the minute.
	time: v.optional(
		v.nullable(
			v.pipe(
				v.string(),
				v.regex(TIME_RE),
				v.transform((t) => t.slice(0, 5)),
			),
		),
		null,
	),
	merchant: displayText(1, 100),
	amount: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10_000_000)),
	category: v.picklist(CATEGORIES), // '분류 확인 필요' must be resolved before saving
	// Model-written; strip control chars (e.g. newlines) instead of rejecting the save.
	reason: v.optional(
		v.pipe(
			v.string(),
			v.maxLength(300),
			v.transform((s) => s.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').trim()),
		),
		'',
	),
	memo: v.optional(displayText(0, 300), ''),
	conversationId: v.optional(v.nullable(v.pipe(v.string(), v.regex(CONVERSATION_ID_RE)))),
	/** Set after the user saw the possible-duplicate warning and chose to save anyway. */
	allowDuplicate: v.optional(v.boolean(), false),
});
export type EntryBody = v.InferOutput<typeof EntryBody>;

export const IdempotencyKey = v.pipe(v.string(), v.uuid());
export const Month = v.pipe(v.string(), v.regex(/^\d{4}-(0[1-9]|1[0-2])$/));
export const JoinBody = v.object({ inviteCode: v.pipe(v.string(), v.maxLength(40)), name: MemberName });
export const TreasurerJoinBody = v.object({ adminCode: v.pipe(v.string(), v.maxLength(40)), name: MemberName });
