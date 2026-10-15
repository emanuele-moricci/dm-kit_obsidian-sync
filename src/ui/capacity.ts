import type { Quota } from "../contract/types";
import { STRINGS } from "../strings";
import { formatBytes } from "./format";

interface CapacityUsage {
	bytes: number;
	notes: number;
}

export function capacityRatio(
	quota: Pick<Quota, "limitBytes" | "limitNotes">,
	usage: CapacityUsage,
): number {
	const bytes = quota.limitBytes > 0 ? usage.bytes / quota.limitBytes : 1;
	const notes = quota.limitNotes > 0 ? usage.notes / quota.limitNotes : 1;
	return Math.min(1, Math.max(bytes, notes));
}

export function renderCapacity(
	parent: HTMLElement,
	quota: Pick<Quota, "plan" | "limitBytes" | "limitNotes">,
	usage: CapacityUsage,
) {
	parent.createEl("p", {
		cls: "dmk-sync-muted",
		text: STRINGS.capacity.line(
			{
				used: formatBytes(usage.bytes),
				limit: formatBytes(quota.limitBytes),
			},
			{ used: usage.notes, limit: quota.limitNotes },
			STRINGS.capacity.plan[quota.plan],
		),
	});
	const ratio = capacityRatio(quota, usage);
	const bar = parent.createDiv({ cls: "dmk-sync-capacity" });
	if (ratio >= 1) {
		bar.addClass("is-full");
	}
	const fill = bar.createDiv({ cls: "dmk-sync-capacity-fill" });
	fill.setCssProps({ width: `${Math.round(ratio * 100)}%` });
}
