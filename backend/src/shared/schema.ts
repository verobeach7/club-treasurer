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

export const REVIEW_FIELDS = ['date', 'merchant', 'amount', 'category'] as const;

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
