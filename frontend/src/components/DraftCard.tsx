import { useState } from 'react';
import { CATEGORIES, CATEGORY_NEEDS_REVIEW, errorMessage, saveEntry, won, type Entry } from '../lib/api.ts';
import type { Session } from '../lib/session.ts';
import { Field, inputClass, primaryButton } from '../pages/Home.tsx';

/** What the agent proposed (untrusted; only used to prefill the form). */
export interface Proposal {
	isReceipt: boolean;
	date: string | null;
	merchant: string | null;
	amount: number | null;
	category: string;
	reason: string;
	needsReview: string[];
}

type FieldName = 'date' | 'merchant' | 'amount' | 'category';

export function DraftCard({
	session,
	conversationId,
	proposal,
	notice,
	onSaved,
}: {
	session: Session;
	conversationId: string | null;
	proposal: Proposal | null;
	notice?: string;
	onSaved: (e: Entry) => void;
}) {
	const [date, setDate] = useState(proposal?.date ?? '');
	const [merchant, setMerchant] = useState(proposal?.merchant ?? '');
	const [amount, setAmount] = useState(proposal?.amount != null ? String(proposal.amount) : '');
	const [category, setCategory] = useState(
		proposal && (CATEGORIES as readonly string[]).includes(proposal.category) ? proposal.category : '',
	);
	const [memo, setMemo] = useState('');
	// One key per draft: a double tap or a retry after a lost response saves one row.
	const [idempotencyKey] = useState(() => crypto.randomUUID());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const review = new Set<FieldName>((proposal?.needsReview ?? []) as FieldName[]);
	if (proposal && !proposal.date) review.add('date');
	if (proposal && !proposal.merchant) review.add('merchant');
	if (proposal && proposal.amount == null) review.add('amount');
	if (proposal && !category) review.add('category');
	const flag = (f: FieldName) => (review.has(f) ? 'border-amber-400 bg-amber-50' : '');

	const amountNumber = Number(amount.replace(/[^\d]/g, ''));
	const valid =
		/^\d{4}-\d{2}-\d{2}$/.test(date) &&
		merchant.trim().length > 0 &&
		Number.isInteger(amountNumber) &&
		amountNumber >= 1 &&
		amountNumber <= 10_000_000 &&
		category.length > 0;

	async function save(e: React.FormEvent) {
		e.preventDefault();
		if (!valid) return;
		setBusy(true);
		setError(null);
		try {
			const r = await saveEntry(session, idempotencyKey, {
				date,
				merchant: merchant.trim(),
				amount: amountNumber,
				category,
				reason: proposal?.reason ?? '',
				memo: memo.trim(),
				conversationId,
			});
			onSaved(r.entry);
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={save} className="space-y-4">
			{notice && <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">{notice}</p>}
			{proposal?.reason && (
				<p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
					<span className="font-semibold">AI 근거 · </span>
					{proposal.reason}
				</p>
			)}
			{review.size > 0 && proposal && (
				<p className="text-xs text-amber-700">노란 칸은 AI가 확실하지 않은 항목입니다. 사진과 비교해 확인해 주세요.</p>
			)}

			<div className="grid gap-4 sm:grid-cols-2">
				<Field label="날짜">
					<input
						type="date"
						className={`${inputClass} ${flag('date')}`}
						value={date}
						onChange={(e) => setDate(e.target.value)}
						min="2020-01-01"
						required
					/>
				</Field>
				<Field label="금액 (원)" hint={amountNumber > 0 ? won(amountNumber) : undefined}>
					<input
						inputMode="numeric"
						className={`${inputClass} ${flag('amount')}`}
						value={amount}
						onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
						placeholder="예: 23000"
						required
					/>
				</Field>
			</div>
			<Field label="상호">
				<input
					className={`${inputClass} ${flag('merchant')}`}
					value={merchant}
					onChange={(e) => setMerchant(e.target.value)}
					maxLength={100}
					required
				/>
			</Field>
			<Field
				label="분류"
				hint={proposal?.category === CATEGORY_NEEDS_REVIEW ? 'AI가 분류를 정하지 못했습니다. 직접 골라 주세요.' : undefined}
			>
				<select
					className={`${inputClass} ${flag('category')}`}
					value={category}
					onChange={(e) => setCategory(e.target.value)}
					required
				>
					<option value="" disabled>
						분류를 선택하세요
					</option>
					{CATEGORIES.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
			</Field>
			<Field label="메모 (선택)">
				<input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={300} />
			</Field>

			{error && (
				<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
					{error}
				</p>
			)}
			<button type="submit" disabled={!valid || busy} className={primaryButton}>
				{busy ? '저장 중…' : '장부에 저장'}
			</button>
		</form>
	);
}
