// RFC 4180 CSV with a UTF-8 BOM so Excel opens Korean text correctly.
// Cells that a spreadsheet would treat as a formula (=, +, -, @, tab, CR) get a leading
// apostrophe (OWASP "CSV Injection"): merchant/memo/reason come from users and the model.
import type { Entry } from './store.ts';

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number): string {
	let s = String(value);
	if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`;
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function entriesToCsv(entries: Entry[]): string {
	const header = ['날짜', '상호', '금액', '분류', '메모', 'AI 근거', '저장자', '저장 시각(UTC)'];
	const rows = entries.map((e) => [e.date, e.merchant, e.amount, e.category, e.memo, e.reason, e.savedBy.name, e.createdAt]);
	return `﻿${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}
