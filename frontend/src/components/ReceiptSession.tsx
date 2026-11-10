import { useFlueAgent } from '@flue/react';
import { createFlueClient, FlueApiError } from '@flue/sdk';
import { useEffect, useMemo, useRef, useState } from 'react';
import { agentUrl, type Entry } from '../lib/api.ts';
import type { ResizedImage } from '../lib/resizeImage.ts';
import type { Session } from '../lib/session.ts';
import { DraftCard, type Proposal } from './DraftCard.tsx';

/** Light shape check: model output is untrusted and only prefills the form. */
function asProposal(output: unknown): Proposal | null {
	if (!output || typeof output !== 'object') return null;
	const o = output as Record<string, unknown>;
	const str = (v: unknown) => (typeof v === 'string' ? v : null);
	return {
		isReceipt: o.isReceipt !== false,
		date: str(o.date),
		time: str(o.time),
		merchant: str(o.merchant),
		amount: typeof o.amount === 'number' && Number.isInteger(o.amount) ? o.amount : null,
		category: str(o.category) ?? '',
		reason: (str(o.reason) ?? '').slice(0, 300),
		needsReview: Array.isArray(o.needsReview) ? o.needsReview.filter((x): x is string => typeof x === 'string') : [],
	};
}

/**
 * One receipt = one server-issued conversation. Sends the image once, then renders the
 * agent's first `propose_entry` result as an editable draft.
 * React + Flue: https://flueframework.com/docs/guide/react/
 */
export function ReceiptSession({
	session,
	conversationId,
	image,
	onSaved,
}: {
	session: Session;
	conversationId: string;
	image: ResizedImage;
	onSaved: (e: Entry, similar: Entry[]) => void;
}) {
	// Memoized: a new client instance replaces the session.
	const client = useMemo(
		() => createFlueClient({ url: agentUrl(conversationId), token: session.token }),
		[conversationId, session.token],
	);
	const agent = useFlueAgent({ client });
	const [sendError, setSendError] = useState<unknown>(null);
	const sent = useRef(false);

	useEffect(() => {
		if (sent.current) return; // StrictMode re-runs effects; the server also rejects a 2nd POST (409)
		sent.current = true;
		agent
			.sendMessage('영수증을 읽어 주세요', {
				images: [{ type: 'image', data: image.base64, mimeType: image.mimeType, filename: 'receipt.jpg' }],
			})
			.catch((e: unknown) => setSendError(e));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Only the FIRST propose_entry part is used.
	const toolPart = agent.messages
		.filter((m) => m.role === 'assistant')
		.flatMap((m) => m.parts)
		.find((p) => p.type === 'dynamic-tool' && p.toolName === 'propose_entry');
	const proposal = toolPart?.type === 'dynamic-tool' && toolPart.state === 'output-available' ? asProposal(toolPart.output) : null;
	const settled = agent.settlements.length > 0;
	const toolFailed = toolPart?.type === 'dynamic-tool' && toolPart.state === 'output-error';

	let body: React.ReactNode;
	if (sendError) {
		const limited = sendError instanceof FlueApiError && sendError.status === 429;
		body = (
			<DraftCard
				key="manual-error"
				session={session}
				conversationId={null}
				proposal={null}
				notice={
					limited
						? '오늘 분석 한도에 도달했습니다. 내일 다시 시도하거나 아래에 직접 입력해 주세요.'
						: '영수증을 보내지 못했습니다. 아래에 직접 입력해 주세요.'
				}
				onSaved={onSaved}
			/>
		);
	} else if (proposal && !proposal.isReceipt) {
		body = (
			<DraftCard
				key="not-receipt"
				session={session}
				conversationId={conversationId}
				proposal={null}
				notice="영수증이 아닌 것 같습니다. 다른 사진을 올리거나 직접 입력해 주세요."
				onSaved={onSaved}
			/>
		);
	} else if (proposal) {
		body = (
			<DraftCard key="proposal" session={session} conversationId={conversationId} proposal={proposal} onSaved={onSaved} />
		);
	} else if (toolFailed || settled) {
		body = (
			<DraftCard
				key="manual"
				session={session}
				conversationId={conversationId}
				proposal={null}
				notice="영수증을 읽지 못했습니다. 아래에 직접 입력해 주세요."
				onSaved={onSaved}
			/>
		);
	} else {
		body = (
			<div className="flex items-center gap-3 rounded-xl bg-teal-50 px-4 py-6 text-teal-900" aria-live="polite">
				<span className="size-5 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
				<span className="font-medium">AI가 영수증을 읽는 중… (10초 정도 걸려요)</span>
			</div>
		);
	}

	return (
		<div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
			<figure className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
				<img src={image.previewUrl} alt="올린 영수증" className="max-h-[70vh] w-full object-contain" />
			</figure>
			<div>{body}</div>
		</div>
	);
}
