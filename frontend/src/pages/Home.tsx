import { useState } from 'react';
import { createClub, errorMessage, joinAsTreasurer, joinClub } from '../lib/api.ts';
import type { Session } from '../lib/session.ts';

type Tab = 'create' | 'join';
/** Joining as a member (invite code) or re-entering as treasurer (admin code). */
type JoinAs = 'member' | 'treasurer';

export function Home({
	onEnter,
}: {
	onEnter: (s: Session, codes: { inviteCode?: string; adminCode?: string }) => void;
}) {
	const [tab, setTab] = useState<Tab>('create');
	const [joinAs, setJoinAs] = useState<JoinAs>('member');
	const [clubName, setClubName] = useState('');
	const [name, setName] = useState('');
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const r =
				tab === 'create'
					? await createClub(clubName.trim(), name.trim())
					: joinAs === 'treasurer'
						? await joinAsTreasurer(code, name.trim())
						: await joinClub(code, name.trim());
			onEnter(
				{ token: r.token, clubId: r.clubId, clubName: r.clubName, name: r.name, role: r.role },
				{ inviteCode: r.inviteCode, adminCode: r.adminCode },
			);
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	const canSubmit =
		!busy && name.trim().length > 0 && (tab === 'create' ? clubName.trim().length > 0 : code.trim().length > 0);

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
							['create', '새 클럽 만들기'],
							['join', '기존 클럽 입장'],
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
						<>
							<p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
								이 버튼은 <strong>항상 새 클럽</strong>을 만듭니다. 이미 만든 클럽에 다시 들어가려면 「기존 클럽 입장」에서
								초대 코드(회원) 또는 관리 코드(재무 이사)를 입력하세요.
							</p>
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
						</>
					) : (
						<>
							<div className="grid grid-cols-2 gap-2 text-sm" role="radiogroup" aria-label="입장 방식">
								{(
									[
										['member', '회원 (초대 코드)'],
										['treasurer', '재무 이사 (관리 코드)'],
									] as const
								).map(([key, label]) => (
									<button
										key={key}
										type="button"
										role="radio"
										aria-checked={joinAs === key}
										onClick={() => {
											setJoinAs(key);
											setCode('');
											setError(null);
										}}
										className={`rounded-lg border px-2 py-2 font-medium ${
											joinAs === key ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-stone-300 text-stone-600'
										}`}
									>
										{label}
									</button>
								))}
							</div>
							<Field
								label={joinAs === 'member' ? '초대 코드' : '관리 코드'}
								hint={
									joinAs === 'member'
										? '재무 이사에게 받은 12자리 코드'
										: '클럽을 만들 때 받은 16자리 코드. 잃어버렸다면 기존 기기에서 재발급하세요.'
								}
							>
								<input
									className={`${inputClass} font-mono uppercase tracking-widest`}
									value={code}
									onChange={(e) => setCode(e.target.value)}
									placeholder={joinAs === 'member' ? 'XXXX-XXXX-XXXX' : 'XXXX-XXXX-XXXX-XXXX'}
									maxLength={24}
									autoCapitalize="characters"
									autoComplete="off"
									required
									autoFocus
								/>
							</Field>
						</>
					)}
					<Field label={tab === 'create' || joinAs === 'treasurer' ? '내 이름 (재무 이사)' : '내 이름'}>
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
