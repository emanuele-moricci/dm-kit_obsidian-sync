import { STRINGS } from "../strings";
import type { SyncOutcome } from "../sync/types";

export function resultLines(outcome: SyncOutcome): string[] {
	const text = STRINGS.result;
	const lines: string[] = [];
	const entries: [number, (count: number) => string][] = [
		[outcome.pushed, text.added],
		[outcome.updated, text.updated],
		[outcome.retried, text.retried],
		[outcome.removed, text.removed],
		[outcome.unchanged, text.unchanged],
		[outcome.skipped.length, text.skipped],
		[outcome.rejected.length, text.rejected],
	];
	for (const [count, format] of entries) {
		if (count > 0) {
			lines.push(format(count));
		}
	}
	return lines;
}

export function renderResult(parent: HTMLElement, outcome: SyncOutcome) {
	const list = parent.createEl("ul", { cls: "dmk-sync-counts" });
	for (const line of resultLines(outcome)) {
		list.createEl("li", { text: line });
	}
	if (outcome.rejected.length > 0) {
		const details = parent.createEl("details", { cls: "dmk-sync-group" });
		details.createEl("summary", {
			text: STRINGS.result.rejected(outcome.rejected.length),
		});
		const rejected = details.createEl("ul");
		for (const entry of outcome.rejected) {
			rejected.createEl("li", {
				text: `${entry.path} — ${STRINGS.rejection[entry.code]}`,
			});
		}
	}
	if (outcome.removalSkipped) {
		parent.createEl("p", { text: STRINGS.result.removalKept });
	}
	if (outcome.finishFailed) {
		parent.createEl("p", { text: STRINGS.result.finishFailed });
	}
	if (outcome.pushed + outcome.updated + outcome.retried > 0) {
		parent.createEl("p", {
			text: STRINGS.result.indexingNote,
			cls: "dmk-sync-muted",
		});
	}
}
