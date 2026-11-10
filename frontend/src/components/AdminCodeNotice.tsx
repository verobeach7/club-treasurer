import { useState } from 'react';

/**
 * Shows a freshly issued treasurer admin code once. The server keeps only a hash,
 * so after dismissal it can't be shown again (only re-issued).
 */
export function AdminCodeNotice({ code, onDismiss }: { code: string; onDismiss: () => void }) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
		} catch {
			// Clipboard blocked: the code stays visible to copy by hand.
		}
	}

	return (
		<section role="alert" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
			<h2 className="font-semibold text-amber-950">재무 이사 관리 코드를 따로 보관하세요</h2>
			<p className="mt-1 text-sm text-amber-900">
				다른 기기나 브라우저에서 <strong>재무 이사로</strong> 다시 들어갈 때 필요합니다. 이 코드는{' '}
				<strong>지금 한 번만</strong> 보입니다. 회원에게 주는 초대 코드와 다르니 공유하지 마세요.
			</p>
			<div className="mt-4 flex flex-wrap items-center gap-2">
				<code className="rounded-lg bg-white px-3 py-2 font-mono text-lg font-semibold tracking-wider text-stone-900 select-all">
					{code}
				</code>
				<button
					type="button"
					onClick={copy}
					className="rounded-lg border border-amber-500 px-3 py-2 text-sm font-semibold text-amber-900"
				>
					{copied ? '복사됨' : '복사'}
				</button>
				<button
					type="button"
					onClick={onDismiss}
					className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
				>
					보관했어요
				</button>
			</div>
			<p className="mt-3 text-xs text-amber-800">잃어버리면 재무 이사 화면 상단의 「관리 코드 재발급」으로 새로 받을 수 있습니다.</p>
		</section>
	);
}
