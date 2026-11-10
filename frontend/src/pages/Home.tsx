import { useState } from 'react';
import { createClub, errorMessage, joinClub } from '../lib/api.ts';
import type { Session } from '../lib/session.ts';

type Tab = 'create' | 'join';

export function Home({ onEnter }: { onEnter: (s: Session, inviteCode?: string) => void }) {
	const [tab, setTab] = useState<Tab>('create');
	const [clubName, setClubName] = useState('');
	const [name, setName] = useState('');
	const [inviteCode, setInviteCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const r =
				tab === 'create' ? await createClub(clubName.trim(), name.trim()) : await joinClub(inviteCode, name.trim());
			onEnter({ token: r.token, clubId: r.clubId, clubName: r.clubName, name: r.name, role: r.role }, r.inviteCode);
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	const canSubmit =
		!busy && name.trim().length > 0 && (tab === 'create' ? clubName.trim().length > 0 : inviteCode.trim().length > 0);

	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
			<header className="mb-8 text-center">
				<p className="text-sm font-semibold tracking-wide text-teal-700">CLUB TREASURER</p>
				<h1 className="mt-2 text-2xl font-bold">영수증 한 장으로 끝내는 클럽 장부</h1>
				<p className="mt-2 text-sm text-stone-600">
					사진을 올리면 AI가 날짜·상호·금액·분류를 채워 줍니다. 확인하고 저장만 하세요.
				</p>
			</header>

			<div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
				<div className="mb-5 grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-sm font-medium" role="tablist">
					{(
						[
							['create', '클럽 만들기'],
							['join', '초대 코드로 입장'],
						] as const
					).map(([key, label]) => (
						<button
							key={key}
							type="button"
							role="tab"
							aria-selected={tab === key}
							onClick={() => {
								setTab(key);
								setError(null);
							}}
							className={`rounded-lg py-2 transition ${tab === key ? 'bg-white shadow-sm' : 'text-stone-500'}`}
						>
							{label}
						</button>
					))}
				</div>

				<form onSubmit={submit} className="space-y-4">
					{tab === 'create' ? (
						<Field label="클럽 이름" hint="예: 한강 러닝 크루">
							<input
								className={inputClass}
								value={clubName}
								onChange={(e) => setClubName(e.target.value)}
								maxLength={50}
								required
								autoFocus
							/>
						</Field>
					) : (
						<Field label="초대 코드" hint="재무 이사에게 받은 12자리 코드">
							<input
								className={`${inputClass} font-mono uppercase tracking-widest`}
								value={inviteCode}
								onChange={(e) => setInviteCode(e.target.value)}
								placeholder="XXXX-XXXX-XXXX"
								maxLength={20}
								autoCapitalize="characters"
								autoComplete="off"
								required
								autoFocus
							/>
						</Field>
					)}
					<Field label={tab === 'create' ? '내 이름 (재무 이사)' : '내 이름'}>
						<input
							className={inputClass}
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={30}
							autoComplete="nickname"
							required
						/>
					</Field>

					{error && (
						<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
							{error}
						</p>
					)}

					<button type="submit" disabled={!canSubmit} className={primaryButton}>
						{busy ? '잠시만요…' : tab === 'create' ? '클럽 만들기' : '입장하기'}
					</button>
				</form>
			</div>

			<p className="mt-6 text-center text-xs text-stone-500">
				로그인 없이 이 브라우저에 입장 정보가 저장됩니다. 데모 데이터는 삭제될 수 있습니다.
			</p>
		</main>
	);
}

export const inputClass =
	'block w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20';

export const primaryButton =
	'w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
	return (
		<label className="block">
			<span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
			{children}
			{hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
		</label>
	);
}
