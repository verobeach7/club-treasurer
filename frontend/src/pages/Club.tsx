import { useEffect, useState } from 'react';
import { DraftCard } from '../components/DraftCard.tsx';
import { ReceiptSession } from '../components/ReceiptSession.tsx';
import { type Entry, errorMessage, newConversation, won } from '../lib/api.ts';
import { type ResizedImage, resizeImage } from '../lib/resizeImage.ts';
import type { Session } from '../lib/session.ts';
import { primaryButton } from './Home.tsx';

// Primary input is a finger (phone/tablet): offer camera + album. Desktop gets one file-picker button.
// https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer
const touchPrimary = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

type State =
	| { kind: 'idle' }
	| { kind: 'preparing' }
	| { kind: 'reading'; conversationId: string; image: ResizedImage }
	| { kind: 'manual' }
	| { kind: 'saved'; entry: Entry; similar: Entry[] };

export function Club({
	session,
	remaining,
	onChanged,
	onShowLedger,
}: {
	session: Session;
	remaining: number | null;
	onChanged: () => void;
	onShowLedger: (month?: string) => void;
}) {
	const [state, setState] = useState<State>({ kind: 'idle' });
	const [error, setError] = useState<string | null>(null);

	// Release the preview object URL when the receipt changes.
	useEffect(() => {
		if (state.kind !== 'reading') return;
		const url = state.image.previewUrl;
		return () => URL.revokeObjectURL(url);
	}, [state]);

	async function onFile(file: File | undefined) {
		if (!file) return;
		setError(null);
		setState({ kind: 'preparing' });
		let image: ResizedImage;
		try {
			image = await resizeImage(file);
		} catch {
			setState({ kind: 'idle' });
			setError('이 사진 형식을 읽지 못했습니다. JPG나 PNG로 다시 올려 주세요.');
			return;
		}
		try {
			const { conversationId } = await newConversation(session);
			setState({ kind: 'reading', conversationId, image });
			onChanged(); // refresh remaining count
		} catch (err) {
			URL.revokeObjectURL(image.previewUrl);
			setState({ kind: 'idle' });
			setError(errorMessage(err));
		}
	}

	function saved(entry: Entry, similar: Entry[]) {
		setState({ kind: 'saved', entry, similar });
		onChanged();
	}

	function pick(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ''; // allow picking the same file again later
		onFile(file);
	}

	function reset() {
		setState({ kind: 'idle' });
		setError(null);
	}

	return (
		<section className="space-y-4">
			{state.kind === 'idle' || state.kind === 'preparing' ? (
				<div className="rounded-2xl border-2 border-dashed border-stone-300 bg-white p-6 text-center">
					<p className="text-lg font-semibold">영수증 사진 1장을 올려 주세요</p>
					<p className="mt-1 text-sm text-stone-600">
						카드번호·이름 같은 개인정보는 가리고 올려 주세요. 데모 데이터는 삭제될 수 있습니다.
					</p>
					{state.kind === 'preparing' ? (
						<p className="mt-5 font-semibold text-teal-800">사진 준비 중…</p>
					) : !touchPrimary ? (
						<label className={`${primaryButton} mt-5 inline-block cursor-pointer sm:w-auto sm:px-6`}>
							사진 파일 선택
							<input type="file" accept="image/*" className="sr-only" disabled={remaining === 0} onChange={pick} />
						</label>
					) : (
						<div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
							{/* iOS opens the camera directly when `capture` is set, so the album needs its own input. */}
							<label className={`${primaryButton} cursor-pointer sm:w-auto sm:px-6`}>
								사진 찍기
								<input
									type="file"
									accept="image/*"
									capture="environment"
									className="sr-only"
									disabled={remaining === 0}
									onChange={pick}
								/>
							</label>
							<label className="cursor-pointer rounded-xl border border-teal-700 px-6 py-3 font-semibold text-teal-800 hover:bg-teal-50">
								앨범에서 고르기
								<input type="file" accept="image/*" className="sr-only" disabled={remaining === 0} onChange={pick} />
							</label>
						</div>
					)}
					<p className="mt-3 text-xs text-stone-500">
						{remaining === null ? '' : remaining > 0 ? `오늘 남은 분석 ${remaining}회` : '오늘 분석 한도를 모두 썼습니다.'}
					</p>
					<button type="button" onClick={() => setState({ kind: 'manual' })} className="mt-2 text-sm text-teal-700 underline">
						사진 없이 직접 입력하기
					</button>
					{error && (
						<p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
							{error}
						</p>
					)}
				</div>
			) : null}

			{state.kind === 'reading' && (
				<div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
					<ReceiptSession
						key={state.conversationId}
						session={session}
						conversationId={state.conversationId}
						image={state.image}
						onSaved={saved}
					/>
					<button type="button" onClick={reset} className="mt-4 text-sm text-stone-500 underline">
						취소하고 다른 사진 올리기
					</button>
				</div>
			)}

			{state.kind === 'manual' && (
				<div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-6">
					<h2 className="mb-4 text-lg font-semibold">직접 입력</h2>
					<DraftCard session={session} conversationId={null} proposal={null} onSaved={saved} />
					<button type="button" onClick={reset} className="mt-4 text-sm text-stone-500 underline">
						취소
					</button>
				</div>
			)}

			{state.kind === 'saved' && (
				<div className="rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center">
					<p className="text-lg font-semibold text-teal-900">장부에 저장했습니다</p>
					<p className="mt-2 text-teal-900">
						{state.entry.date}
						{state.entry.time ? ` ${state.entry.time}` : ''} · {state.entry.merchant} ·{' '}
						<strong>{won(state.entry.amount)}</strong> · {state.entry.category}
					</p>
					{state.similar.length > 0 && (
						<p className="mx-auto mt-3 max-w-md rounded-lg bg-white/70 px-3 py-2 text-sm text-stone-700">
							참고: 같은 날 같은 금액 기록이 {state.similar.length}건 더 있습니다(결제 시각이 달라 다른 결제로 저장했어요).
						</p>
					)}
					<div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
						<button type="button" onClick={reset} className={`${primaryButton} sm:w-auto sm:px-6`}>
							다음 영수증
						</button>
						<button
							type="button"
							onClick={() => onShowLedger(state.entry.date.slice(0, 7))}
							className="rounded-xl border border-teal-700 px-6 py-3 font-semibold text-teal-800"
						>
							장부 보기
						</button>
					</div>
				</div>
			)}
		</section>
	);
}
