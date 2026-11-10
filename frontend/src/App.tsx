import { useCallback, useEffect, useState } from 'react';
import { AdminCodeNotice } from './components/AdminCodeNotice.tsx';
import { InviteBox } from './components/InviteBox.tsx';
import { ApiError, errorMessage, getMe, rotateAdminCode } from './lib/api.ts';
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
	/** A just-issued admin code, shown once until dismissed. */
	const [adminCode, setAdminCode] = useState<string | null>(null);
	const [rotateStep, setRotateStep] = useState<'idle' | 'confirm' | 'busy'>('idle');
	const [rotateError, setRotateError] = useState<string | null>(null);

	async function rotate() {
		if (!session) return;
		setRotateStep('busy');
		setRotateError(null);
		try {
			setAdminCode((await rotateAdminCode(session)).adminCode);
		} catch (err) {
			setRotateError(errorMessage(err));
		} finally {
			setRotateStep('idle');
		}
	}

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
				onEnter={(s, codes) => {
					saveSession(s);
					setSession(s);
					setInviteCode(codes.inviteCode ?? null);
					setAdminCode(codes.adminCode ?? null);
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
		setAdminCode(null);
		setRotateStep('idle');
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
						{session.role === 'treasurer' &&
							(rotateStep === 'confirm' ? (
								<span className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
									<span className="text-teal-50">이전 관리 코드는 못 쓰게 됩니다.</span>
									<button type="button" onClick={rotate} className="font-semibold underline">
										재발급
									</button>
									<button type="button" onClick={() => setRotateStep('idle')} className="text-teal-100">
										취소
									</button>
								</span>
							) : (
								<button
									type="button"
									disabled={rotateStep === 'busy'}
									onClick={() => setRotateStep('confirm')}
									className="text-sm text-teal-100 underline"
								>
									관리 코드 재발급
								</button>
							))}
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
				{adminCode && <AdminCodeNotice code={adminCode} onDismiss={() => setAdminCode(null)} />}
				{rotateError && (
					<p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
						{rotateError}
					</p>
				)}
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
