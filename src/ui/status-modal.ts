import { type App, Modal } from "obsidian";
import type { StatusResponse } from "../contract/types";
import { describeError } from "../errors";
import { fire } from "../fire";
import { STRINGS } from "../strings";
import type { ClientResult } from "../sync/types";
import { renderCapacity } from "./capacity";
import { formatRelativeTime } from "./format";

export class StatusModal extends Modal {
	private readonly load: () => Promise<ClientResult<StatusResponse>>;

	constructor(app: App, load: () => Promise<ClientResult<StatusResponse>>) {
		super(app);
		this.load = load;
	}

	onOpen() {
		fire(this.refresh());
	}

	onClose() {
		this.contentEl.empty();
	}

	private async refresh() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("dmk-sync-modal");
		contentEl.createEl("h2", { text: STRINGS.status.title });
		const loading = contentEl.createEl("p", { text: STRINGS.status.loading });
		loading.setAttr("role", "status");
		const result = await this.load();
		contentEl.empty();
		contentEl.createEl("h2", { text: STRINGS.status.title });
		if (result.ok) {
			this.renderStatus(result.value);
		} else {
			contentEl
				.createEl("p", { text: describeError(result.error).message })
				.setAttr("role", "alert");
		}
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		const refresh = buttons.createEl("button", {
			text: STRINGS.status.refresh,
		});
		refresh.addEventListener("click", () => fire(this.refresh()));
		const close = buttons.createEl("button", {
			text: STRINGS.result.close,
			cls: "mod-cta",
		});
		close.addEventListener("click", () => this.close());
	}

	private renderStatus(status: StatusResponse) {
		const { contentEl } = this;
		contentEl.createEl("p", {
			text: status.lastSyncAt
				? STRINGS.status.lastSync(
						formatRelativeTime(status.lastSyncAt, Date.now()),
					)
				: STRINGS.status.neverSynced,
		});
		const list = contentEl.createEl("ul", { cls: "dmk-sync-counts" });
		list.createEl("li", { text: STRINGS.status.notes(status.counts.total) });
		if (status.counts.processing > 0) {
			list.createEl("li", {
				text: STRINGS.status.processing(status.counts.processing),
			});
		}
		if (status.counts.error > 0) {
			list.createEl("li", { text: STRINGS.status.failed(status.counts.error) });
		}
		renderCapacity(contentEl, status.quota, {
			bytes: status.quota.usedBytes,
			notes: status.quota.usedNotes,
		});
		if (status.lastError) {
			const known =
				STRINGS.lastError[
					status.lastError.code as keyof typeof STRINGS.lastError
				];
			contentEl.createEl("p", {
				text: `${STRINGS.status.lastError}: ${known ?? status.lastError.code}`,
			});
		}
		if (status.errors.length > 0) {
			const details = contentEl.createEl("details", { cls: "dmk-sync-group" });
			details.createEl("summary", { text: STRINGS.status.failedList });
			const errors = details.createEl("ul");
			for (const entry of status.errors) {
				errors.createEl("li", {
					text: entry.error ? `${entry.path} — ${entry.error}` : entry.path,
				});
			}
		}
	}
}
