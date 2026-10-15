import { PUSH_BATCH_FILES } from "../contract/limits";
import type { ExecuteProgress, ManifestProgress } from "./types";

export interface BusyProgress {
	fraction: number;
	ceiling: number;
}

const READ_SHARE = 0.7;
const CONTACT_CEILING = 0.95;
const PUSH_SHARE = 0.85;
const REMOVE_SHARE = 0.1;
const FINISH_CEILING = 0.99;

function ratio(done: number, total: number): number {
	return total > 0 ? Math.min(1, done / total) : 1;
}

export function prepareProgress(progress: ManifestProgress): BusyProgress {
	if (progress.done >= progress.total) {
		return { fraction: READ_SHARE, ceiling: CONTACT_CEILING };
	}
	const fraction = READ_SHARE * ratio(progress.done, progress.total);
	return { fraction, ceiling: fraction };
}

export function startProgress(): BusyProgress {
	return { fraction: 0, ceiling: 0.08 };
}

export function executeProgress(progress: ExecuteProgress): BusyProgress {
	if (progress.phase === "push" || progress.phase === "wait") {
		const fraction = PUSH_SHARE * ratio(progress.done, progress.total);
		const ceiling =
			progress.phase === "wait"
				? fraction
				: PUSH_SHARE * ratio(progress.done + PUSH_BATCH_FILES, progress.total);
		return { fraction, ceiling };
	}
	if (progress.phase === "remove") {
		const fraction =
			PUSH_SHARE + REMOVE_SHARE * ratio(progress.done, progress.total);
		return { fraction, ceiling: fraction };
	}
	return { fraction: PUSH_SHARE + REMOVE_SHARE, ceiling: FINISH_CEILING };
}

export function creep(shown: number, progress: BusyProgress): number {
	const floor = Math.max(shown, progress.fraction);
	if (floor >= progress.ceiling) {
		return floor;
	}
	return floor + (progress.ceiling - floor) * 0.1;
}
