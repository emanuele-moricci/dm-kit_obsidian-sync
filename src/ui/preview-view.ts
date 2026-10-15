import type { PlanResponse, SkipReason } from "../contract/types";
import { STRINGS } from "../strings";
import { renderCapacity } from "./capacity";

export interface PreviewActions {
	onApproveChange: (approved: boolean) => void;
}

function renderList(parent: HTMLElement, label: string, paths: string[]) {
	if (paths.length === 0) {
		return;
	}
	const details = parent.createEl("details", { cls: "dmk-sync-group" });
	details.createEl("summary", { text: `${label} (${paths.length})` });
	const list = details.createEl("ul");
	for (const path of paths) {
		list.createEl("li", { text: path });
	}
}

function renderSkipped(
	parent: HTMLElement,
	skipped: Array<{ path: string; reason: SkipReason }>,
) {
	if (skipped.length === 0) {
		return;
	}
	const details = parent.createEl("details", { cls: "dmk-sync-group" });
	details.createEl("summary", {
		text: `${STRINGS.preview.skipped} (${skipped.length})`,
	});
	const list = details.createEl("ul");
	for (const entry of skipped) {
		list.createEl("li", {
			text: `${entry.path} — ${STRINGS.skipReason[entry.reason]}`,
		});
	}
}

function renderRemovalBand(
	parent: HTMLElement,
	plan: PlanResponse,
	actions: PreviewActions,
) {
	const band = parent.createDiv({ cls: "dmk-sync-removal-band" });
	band.setAttr("role", "group");
	band.createEl("strong", {
		text: STRINGS.preview.removeBand(plan.remove.length),
	});
	band.createEl("p", { text: STRINGS.preview.removeExplain });
	renderList(band, STRINGS.preview.remove, plan.remove);
	const label = band.createEl("label", { cls: "dmk-sync-approve" });
	const checkbox = label.createEl("input", { type: "checkbox" });
	label.appendText(` ${STRINGS.preview.removeApprove}`);
	checkbox.addEventListener("change", () =>
		actions.onApproveChange(checkbox.checked),
	);
}

export function renderPreview(
	parent: HTMLElement,
	plan: PlanResponse,
	actions: PreviewActions,
) {
	parent.createEl("p", {
		text: STRINGS.preview.campaign(plan.campaign.name),
		cls: "dmk-sync-campaign",
	});
	if (plan.unchangedCount > 0) {
		parent.createEl("p", {
			text: `${STRINGS.preview.unchanged}: ${plan.unchangedCount}`,
			cls: "dmk-sync-muted",
		});
	}
	renderList(parent, STRINGS.preview.add, plan.add);
	renderList(parent, STRINGS.preview.update, plan.update);
	renderList(parent, STRINGS.preview.retry, plan.retry);
	renderSkipped(parent, plan.skipped);
	if (plan.remove.length > 0) {
		renderRemovalBand(parent, plan, actions);
	}
	renderCapacity(parent, plan.quota, {
		bytes: plan.quota.afterBytes,
		notes: plan.quota.afterNotes,
	});
}
