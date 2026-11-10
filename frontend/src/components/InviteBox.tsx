import { useState } from 'react';

/** Treasurer-only: shows the invite code with a copy button. */
export function InviteBox({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard blocked: the code stays visible to copy by hand.
		}
	}

	return (
		<div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
			<span className="text-teal-100">초대 코드</span>
			<code className="font-mono font-semibold tracking-wider select-all">{code}</code>
			<button type="button" onClick={copy} className="rounded-md bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30">
				{copied ? '복사됨' : '복사'}
			</button>
		</div>
	);
}
