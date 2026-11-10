import { useState } from 'react';
import {
	CATEGORIES,
	CATEGORY_NEEDS_REVIEW,
	duplicatesOf,
	type Entry,
	errorMessage,
	saveEntry,
	won,
} from '../lib/api.ts';
import type { Session } from '../lib/session.ts';
import { Field, inputClass, primaryButton } from '../pages/Home.tsx';

/** What the agent proposed (untrusted; only used to prefill the form). */
export interface Proposal {
	isReceipt: boolean;
	date: string | null;
	time: string | null;
	merchant: string | null;
	amount: number | null;
	category: string;
	reason: string;
	needsReview: string[];
}

type FieldName = 'date' | 'time' | 'merchant' | 'amount' | 'category';

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
	onSaved: (e: Entry, similar: Entry[]) => void;
}) {
	const [date, setDate] = useState(proposal?.date ?? '');
	const [time, setTime] = useState(proposal?.time?.slice(0, 5) ?? '');
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
	/** Set when the server reports the same date + amount + time already in the ledger. */
	const [duplicates, setDuplicates] = useState<Entry[] | null>(null);

	const review = new Set<FieldName>((proposal?.needsReview ?? []) as FieldName[]);
	if (proposal && !proposal.date) review.add('date');
	if (proposal && !proposal.time) review.add('time');
	if (proposal && !proposal.merchant) review.add('merchant');
	if (proposal && proposal.amount == null) review.add('amount');
	if (proposal && !category) review.add('category');
	const flag = (f: FieldName) => (review.has(f) ? 'border-amber-400 bg-amber-50' : '');

	const amountNumber = Number(amount.replace(/[^\d]/g, ''));
	const valid =
		/^\d{4}-\d{2}-\d{2}$/.test(date) &&
		(time === '' || /^\d{2}:\d{2}$/.test(time)) &&
		merchant.trim().length > 0 &&
		Number.isInteger(amountNumber) &&
		amountNumber >= 1 &&
		amountNumber <= 10_000_000 &&
		category.length > 0;

	async function submit(allowDuplicate: boolean) {
		if (!valid) return;
		setBusy(true);
		setError(null);
		try {
			const r = await saveEntry(session, idempotencyKey, {
				date,
				time: time || null,
				merchant: merchant.trim(),
				amount: amountNumber,
				category,
				reason: proposal?.reason ?? '',
				memo: memo.trim(),
				conversationId,
				allowDuplicate,
			});
			onSaved(r.entry, r.similar ?? []);
		} catch (err) {
			const dups = duplicatesOf(err);
			if (dups) setDuplicates(dups);
			else setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	if (duplicates) {
		return (
			<div className="space-y-4" role="alert">
				<div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
					<p className="font-semibold text-amber-900">이미 장부에 있는 영수증 같습니다</p>
					<p className="mt-1 text-sm text-amber-900">
						같은 날짜·금액{time ? '·결제 시각' : ''}의 기록이 있습니다. 같은 영수증을 두 번 올린 건 아닌지 확인해 주세요.
					</p>
					<ul className="mt-3 space-y-1 text-sm text-amber-950">
						{duplicates.map((d) => (
							<li key={d.id} className="rounded-lg bg-white/70 px-3 py-2">
								{d.date}
								{d.time ? ` ${d.time}` : ''} · {d.merchant} · <strong>{won(d.amount)}</strong> · 저장: {d.savedBy.name}
							</li>
						))}
					</ul>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row">
					<button type="button" onClick={() => setDuplicates(null)} className={`${primaryButton} sm:flex-1`}>
						저장하지 않고 돌아가기
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={() => submit(true)}
						className="rounded-xl border border-amber-500 px-4 py-3 font-semibold text-amber-900 sm:flex-1"
					>
						{busy ? '저장 중…' : '다른 결제가 맞아요, 그래도 저장'}
					</button>
				</div>
			</div>
		);
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				submit(false);
			}}
			className="space-y-4"
		>
			{notice && <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">{notice}</p>}
			{proposal?.reason && (
				<p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
					<span className="font-semibold">AI 근거 · </span>
					{proposal.reason}
				</p>
			)}
			{review.size > 0 && proposal && (
				<p className="text-xs text-amber-700">노란 칸은 AI가 확실하지 않거나 읽지 못한 항목입니다. 사진과 비교해 확인해 주세요.</p>
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
				<Field label="결제 시각 (선택)" hint="중복 영수증을 거르는 데 씁니다">
					<input
						type="time"
						className={`${inputClass} ${flag('time')}`}
						value={time}
						onChange={(e) => setTime(e.target.value.slice(0, 5))}
					/>
				</Field>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
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
				<Field label="상호">
					<input
						className={`${inputClass} ${flag('merchant')}`}
						value={merchant}
						onChange={(e) => setMerchant(e.target.value)}
						maxLength={100}
						required
					/>
				</Field>
			</div>
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
