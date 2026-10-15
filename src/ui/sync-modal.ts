import { type App, Modal } from "obsidian";
import type { DescribedError } from "../errors";
import { STRINGS } from "../strings";
import { type BusyProgress, creep } from "../sync/progress";
import type { ExecuteProgress, PreparedSync, SyncOutcome } from "../sync/types";
import { renderPreview } from "./preview-view";
import { renderResult } from "./result-view";

export type SyncModalState =
	| { kind: "loading"; message: string; progress?: BusyProgress }
	| { kind: "preview"; prepared: PreparedSync }
	| { kind: "running"; message: string; progress?: BusyProgress }
	| { kind: "result"; outcome: SyncOutcome }
	| { kind: "error"; error: DescribedError };

export interface SyncModalHandlers {
	onSync: (approveRemovals: boolean) => void;
	onDismiss: () => void;
	onRetry: () => void;
	onOpenSettings: () => void;
}

const CREEP_INTERVAL_MS = 400;
const PERCENT = 100;

interface BusyView {
	text: HTMLElement;
	bar: HTMLElement;
	fill: HTMLElement;
}

export function progressMessage(progress: ExecuteProgress): string {
	if (progress.phase === "wait") {
		return STRINGS.progress.wait(progress.waitSeconds ?? 1);
	}
	if (progress.phase === "push") {
		return STRINGS.progress.push(progress.done, progress.total);
	}
	if (progress.phase === "remove") {
		return STRINGS.progress.remove(progress.done, progress.total);
	}
	return STRINGS.progress.finish;
}

export class SyncModal extends Modal {
	private readonly handlers: SyncModalHandlers;
	private approveRemovals = false;
	private settled = false;
	private closed = false;
	private busy: BusyView | null = null;
	private busyProgress: BusyProgress | null = null;
	private shown = 0;
	private creepTimer: number | null = null;

	constructor(app: App, handlers: SyncModalHandlers) {
		super(app);
		this.handlers = handlers;
	}

	onOpen() {
		this.closed = false;
	}

	onClose() {
		this.closed = true;
		this.stopCreep();
		this.busy = null;
		this.contentEl.empty();
		if (!this.settled) {
			this.settled = true;
			this.handlers.onDismiss();
		}
	}

	show(state: SyncModalState) {
		if (this.closed) {
			return;
		}
		const { contentEl } = this;
		if ((state.kind === "loading" || state.kind === "running") && this.busy) {
			this.updateBusy(state.message, state.progress);
			return;
		}
		this.stopCreep();
		this.busy = null;
		contentEl.empty();
		contentEl.addClass("dmk-sync-modal");
		this.approveRemovals = false;
		if (state.kind === "loading" || state.kind === "running") {
			this.renderBusy(state.message, state.progress);
		} else if (state.kind === "preview") {
			this.renderPreviewState(state.prepared);
		} else if (state.kind === "result") {
			this.renderResultState(state.outcome);
		} else {
			this.renderErrorState(state.error);
		}
	}

	private renderBusy(message: string, progress?: BusyProgress) {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: STRINGS.preview.title });
		const text = contentEl.createEl("p", { text: message });
		text.setAttr("role", "status");
		text.setAttr("aria-live", "polite");
		const bar = contentEl.createDiv({ cls: "dmk-sync-progress" });
		bar.setAttr("role", "progressbar");
		bar.setAttr("aria-valuemin", "0");
		bar.setAttr("aria-valuemax", String(PERCENT));
		const fill = bar.createDiv({ cls: "dmk-sync-progress-fill" });
		this.busy = { text, bar, fill };
		this.shown = 0;
		this.busyProgress = null;
		this.updateBusy(message, progress);
		this.creepTimer = window.setInterval(
			() => this.tickCreep(),
			CREEP_INTERVAL_MS,
		);
	}

	private updateBusy(message: string, progress?: BusyProgress) {
		const busy = this.busy;
		if (!busy) {
			return;
		}
		busy.text.setText(message);
		if (!progress) {
			busy.bar.addClass("is-indeterminate");
			busy.bar.removeAttribute("aria-valuenow");
			busy.fill.setCssProps({ width: "" });
			return;
		}
		busy.bar.removeClass("is-indeterminate");
		this.busyProgress = progress;
		this.shown = Math.max(this.shown, progress.fraction);
		this.paint();
	}

	private tickCreep() {
		if (!this.busyProgress) {
			return;
		}
		this.shown = creep(this.shown, this.busyProgress);
		this.paint();
	}

	private paint() {
		const busy = this.busy;
		if (!busy) {
			return;
		}
		const percent = Math.round(this.shown * PERCENT);
		busy.fill.setCssProps({ width: `${percent}%` });
		busy.bar.setAttr("aria-valuenow", String(percent));
	}

	private stopCreep() {
		if (this.creepTimer !== null) {
			window.clearInterval(this.creepTimer);
			this.creepTimer = null;
		}
	}

	private renderPreviewState(prepared: PreparedSync) {
		const { contentEl } = this;
		const { plan } = prepared;
		const hasChanges =
			plan.add.length +
				plan.update.length +
				plan.retry.length +
				plan.remove.length >
			0;
		contentEl.createEl("h2", { text: STRINGS.preview.title });
		if (!hasChanges) {
			contentEl.createEl("p", { text: STRINGS.preview.nothing });
		}
		renderPreview(contentEl, plan, {
			onApproveChange: (approved) => {
				this.approveRemovals = approved;
			},
		});
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		this.addSettingsLink(buttons);
		if (hasChanges) {
			const sync = buttons.createEl("button", {
				text: STRINGS.preview.sync,
				cls: "mod-cta",
			});
			sync.addEventListener("click", () =>
				this.handlers.onSync(this.approveRemovals),
			);
		}
		const cancel = buttons.createEl("button", {
			text: hasChanges ? STRINGS.preview.cancel : STRINGS.preview.syncNothing,
		});
		cancel.addEventListener("click", () => this.close());
	}

	private renderResultState(outcome: SyncOutcome) {
		const { contentEl } = this;
		contentEl.createEl("h2", {
			text:
				outcome.incomplete || outcome.finishFailed
					? STRINGS.result.titleIncomplete
					: STRINGS.result.title,
		});
		renderResult(contentEl, outcome);
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		this.addSettingsLink(buttons);
		const close = buttons.createEl("button", {
			text: STRINGS.result.close,
			cls: "mod-cta",
		});
		close.addEventListener("click", () => this.close());
	}

	private addSettingsLink(buttons: HTMLElement) {
		const link = buttons.createEl("button", {
			text: STRINGS.result.openSettings,
			cls: "dmk-sync-settings-link",
		});
		link.addEventListener("click", () => this.handlers.onOpenSettings());
	}

	private renderErrorState(error: DescribedError) {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: STRINGS.result.titleIncomplete });
		const message = contentEl.createEl("p", { text: error.message });
		message.setAttr("role", "alert");
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		if (error.action === "retry") {
			const retry = buttons.createEl("button", {
				text: STRINGS.result.retry,
				cls: "mod-cta",
			});
			retry.addEventListener("click", () => this.handlers.onRetry());
		}
		if (error.action === "reconnect" || error.action === "review_selection") {
			const settings = buttons.createEl("button", {
				text: STRINGS.result.openSettings,
				cls: "mod-cta",
			});
			settings.addEventListener("click", () => this.handlers.onOpenSettings());
		}
		const close = buttons.createEl("button", { text: STRINGS.result.close });
		close.addEventListener("click", () => this.close());
	}
}
