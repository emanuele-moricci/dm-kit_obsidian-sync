import type { LastSync } from "../state";
import { STRINGS } from "../strings";
import { formatRelativeTime } from "./format";

export type StatusBarMode = "disconnected" | "running" | "idle";

export function statusBarText(
	mode: StatusBarMode,
	lastSync: LastSync | null,
	now: number,
): string {
	const text = STRINGS.status.bar;
	if (mode === "disconnected") {
		return text.disconnected;
	}
	if (mode === "running") {
		return text.running;
	}
	if (!lastSync) {
		return text.idle;
	}
	if (!lastSync.ok) {
		return text.error;
	}
	return text.synced(formatRelativeTime(lastSync.at, now));
}
