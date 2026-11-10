import { useCallback, useEffect, useState } from 'react';
import { deleteEntry, downloadCsv, errorMessage, type Ledger as LedgerData, listEntries, won } from '../lib/api.ts';
import type { Session } from '../lib/session.ts';

function currentMonth() {
	return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
}

export function Ledger({ session, initialMonth }: { session: Session; initialMonth?: string }) {
	const [month, setMonth] = useState(() => initialMonth ?? currentMonth());
	const [data, setData] = useState<LedgerData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [confirming, setConfirming] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setData(await listEntries(session, month));
		} catch (err) {
			setError(errorMessage(err));
		}
	}, [session, month]);

	useEffect(() => {
		load();
	}, [load]);

	async function remove(id: string) {
		try {
			await deleteEntry(session, id);
			setConfirming(null);
			await load();
		} catch (err) {
			setError(errorMessage(err));
		}
	}

	async function download(which?: string) {
		setError(null);
		try {
			await downloadCsv(session, which);
		} catch (err) {
			setError(errorMessage(err));
		}
	}

	const months = [...new Set([currentMonth(), month, ...(data?.months ?? [])])].sort().reverse();
	const isTreasurer = session.role === 'treasurer';

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<label className="text-sm">
					<span className="mb-1 block font-medium text-stone-700">월</span>
					<select
						className="rounded-lg border border-stone-300 bg-white px-3 py-2"
						value={month}
						onChange={(e) => setMonth(e.target.value)}
					>
						{months.map((m) => (
							<option key={m} value={m}>
								{m.replace('-', '년 ')}월
							</option>
						))}
					</select>
				</label>
				<div className="text-right">
					<p className="text-sm text-stone-600">월 합계</p>
					<p className="text-2xl font-bold">{won(data?.total ?? 0)}</p>
				</div>
			</div>

			<div className="flex flex-wrap gap-2 text-sm">
				<button
					type="button"
					onClick={() => download(month)}
					disabled={!data || data.entries.length === 0}
					className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-medium hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					이 달 CSV 받기
				</button>
				<button
					type="button"
					onClick={() => download()}
					disabled={!data || data.months.length === 0}
					className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-medium hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					전체 CSV 받기
				</button>
			</div>

			{error && (
				<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
					{error}
				</p>
			)}

			{data && data.byCategory.length > 0 && (
				<ul className="flex flex-wrap gap-2">
					{data.byCategory.map((c) => (
						<li key={c.category} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-stone-200">
							{c.category} <strong>{won(c.amount)}</strong> <span className="text-stone-500">({c.count}건)</span>
						</li>
					))}
				</ul>
			)}

			{data && data.entries.length === 0 && (
				<p className="rounded-xl bg-white px-4 py-10 text-center text-stone-500 ring-1 ring-stone-200">
					이 달에는 기록이 없습니다.
				</p>
			)}

			{data && data.entries.length > 0 && (
				<>
					{/* Mobile: cards */}
					<ul className="space-y-2 md:hidden">
						{data.entries.map((e) => (
							<li key={e.id} className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="truncate font-semibold">{e.merchant}</p>
										<p className="text-sm text-stone-600">
											{e.date} · {e.category}
										</p>
										<p className="text-xs text-stone-500">저장: {e.savedBy.name}</p>
									</div>
									<p className="shrink-0 font-bold">{won(e.amount)}</p>
								</div>
								{e.memo && <p className="mt-2 text-sm text-stone-700">{e.memo}</p>}
								{isTreasurer && (
									<DeleteButton
										confirming={confirming === e.id}
										onAsk={() => setConfirming(e.id)}
										onCancel={() => setConfirming(null)}
										onConfirm={() => remove(e.id)}
									/>
								)}
							</li>
						))}
					</ul>

					{/* Desktop: table */}
					<div className="hidden overflow-hidden rounded-xl bg-white ring-1 ring-stone-200 md:block">
						<table className="w-full text-left text-sm">
							<thead className="bg-stone-100 text-stone-600">
								<tr>
									<th className="px-4 py-3 font-medium">날짜</th>
									<th className="px-4 py-3 font-medium">상호</th>
									<th className="px-4 py-3 font-medium">분류</th>
									<th className="px-4 py-3 text-right font-medium">금액</th>
									<th className="px-4 py-3 font-medium">메모</th>
									<th className="px-4 py-3 font-medium">저장자</th>
									{isTreasurer && <th className="px-4 py-3" />}
								</tr>
							</thead>
							<tbody className="divide-y divide-stone-100">
								{data.entries.map((e) => (
									<tr key={e.id}>
										<td className="px-4 py-3 whitespace-nowrap">{e.date}</td>
										<td className="max-w-56 truncate px-4 py-3">{e.merchant}</td>
										<td className="px-4 py-3 whitespace-nowrap">{e.category}</td>
										<td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{won(e.amount)}</td>
										<td className="max-w-48 truncate px-4 py-3 text-stone-600">{e.memo}</td>
										<td className="px-4 py-3 whitespace-nowrap text-stone-600">{e.savedBy.name}</td>
										{isTreasurer && (
											<td className="px-4 py-3 text-right whitespace-nowrap">
												<DeleteButton
													confirming={confirming === e.id}
													onAsk={() => setConfirming(e.id)}
													onCancel={() => setConfirming(null)}
													onConfirm={() => remove(e.id)}
												/>
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
		</section>
	);
}

function DeleteButton(p: { confirming: boolean; onAsk: () => void; onCancel: () => void; onConfirm: () => void }) {
	if (!p.confirming) {
		return (
			<button type="button" onClick={p.onAsk} className="mt-2 text-sm text-red-700 underline md:mt-0">
				삭제
			</button>
		);
	}
	return (
		<span className="mt-2 inline-flex gap-3 text-sm md:mt-0">
			<button type="button" onClick={p.onConfirm} className="font-semibold text-red-700">
				정말 삭제
			</button>
			<button type="button" onClick={p.onCancel} className="text-stone-500">
				취소
			</button>
		</span>
	);
}
