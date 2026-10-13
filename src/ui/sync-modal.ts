import { type App, Modal } from "obsidian";
import type { DescribedError } from "../errors";
import { STRINGS } from "../strings";
import type { ExecuteProgress, PreparedSync, SyncOutcome } from "../sync/types";
import { renderPreview } from "./preview-view";
import { renderResult } from "./result-view";

export type SyncModalState =
	| { kind: "loading"; message: string }
	| { kind: "preview"; prepared: PreparedSync }
	| { kind: "running"; message: string }
	| { kind: "result"; outcome: SyncOutcome }
	| { kind: "error"; error: DescribedError };

export interface SyncModalHandlers {
	onSync: (approveRemovals: boolean) => void;
	onDismiss: () => void;
	onRetry: () => void;
	onOpenSettings: () => void;
}

export function progressMessage(progress: ExecuteProgress): string {
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

	constructor(app: App, handlers: SyncModalHandlers) {
		super(app);
		this.handlers = handlers;
	}

	onClose() {
		this.contentEl.empty();
		if (!this.settled) {
			this.settled = true;
			this.handlers.onDismiss();
		}
	}

	show(state: SyncModalState) {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("dmk-sync-modal");
		this.approveRemovals = false;
		if (state.kind === "loading" || state.kind === "running") {
			this.renderBusy(state.message);
		} else if (state.kind === "preview") {
			this.renderPreviewState(state.prepared);
		} else if (state.kind === "result") {
			this.renderResultState(state.outcome);
		} else {
			this.renderErrorState(state.error);
		}
	}

	private renderBusy(message: string) {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: STRINGS.preview.title });
		const status = contentEl.createEl("p", { text: message });
		status.setAttr("role", "status");
		status.setAttr("aria-live", "polite");
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
		const close = buttons.createEl("button", {
			text: STRINGS.result.close,
			cls: "mod-cta",
		});
		close.addEventListener("click", () => this.close());
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
