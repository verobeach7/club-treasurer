import { useCallback, useEffect, useState } from 'react';
import { InviteBox } from './components/InviteBox.tsx';
import { ApiError, getMe } from './lib/api.ts';
import { clearSession, loadSession, type Session, saveSession } from './lib/session.ts';
import { Club } from './pages/Club.tsx';
import { Home } from './pages/Home.tsx';
import { Ledger } from './pages/Ledger.tsx';

type View = 'upload' | 'ledger';

export default function App() {
	const [session, setSession] = useState<Session | null>(loadSession);
	const [view, setView] = useState<View>('upload');
	const [ledgerMonth, setLedgerMonth] = useState<string | undefined>(undefined);
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [remaining, setRemaining] = useState<number | null>(null);

	const refreshMe = useCallback(async () => {
		if (!session) return;
		try {
			const me = await getMe(session);
			setInviteCode(me.club.inviteCode ?? null);
			setRemaining(me.remainingAnalyses);
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				clearSession();
				setSession(null);
			}
		}
	}, [session]);

	useEffect(() => {
		refreshMe();
	}, [refreshMe]);

	if (!session) {
		return (
			<Home
				onEnter={(s, code) => {
					saveSession(s);
					setSession(s);
					setInviteCode(code ?? null);
					setView('upload');
				}}
			/>
		);
	}

	function leave() {
		clearSession();
		setSession(null);
		setInviteCode(null);
		setRemaining(null);
	}

	return (
		<div className="min-h-dvh">
			<header className="bg-teal-800 text-white">
				<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
					<div className="min-w-0">
						<p className="truncate text-lg font-bold">{session.clubName}</p>
						<p className="text-sm text-teal-100">
							{session.name} · {session.role === 'treasurer' ? '재무 이사' : '회원'}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{session.role === 'treasurer' && inviteCode && <InviteBox code={inviteCode} />}
						<button type="button" onClick={leave} className="text-sm text-teal-100 underline">
							나가기
						</button>
					</div>
				</div>
				<nav className="mx-auto flex max-w-5xl gap-1 px-4" aria-label="화면">
					{(
						[
							['upload', '영수증 올리기'],
							['ledger', '장부'],
						] as const
					).map(([key, label]) => (
						<button
							key={key}
							type="button"
							onClick={() => {
								setLedgerMonth(undefined);
								setView(key);
							}}
							aria-current={view === key ? 'page' : undefined}
							className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${
								view === key ? 'bg-stone-50 text-teal-900' : 'text-teal-100 hover:text-white'
							}`}
						>
							{label}
						</button>
					))}
				</nav>
			</header>

			<main className="mx-auto max-w-5xl px-4 py-6">
				{view === 'upload' ? (
					<Club
						session={session}
						remaining={remaining}
						onChanged={refreshMe}
						onShowLedger={(month) => {
							setLedgerMonth(month);
							setView('ledger');
						}}
					/>
				) : (
					<Ledger key={ledgerMonth ?? 'current'} session={session} initialMonth={ledgerMonth} />
				)}
			</main>
		</div>
	);
}
