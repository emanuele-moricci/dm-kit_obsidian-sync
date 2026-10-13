import { type App, Notice } from "obsidian";
import { createVaultPort, readKey, transport } from "./adapters";
import { parseConnectionString } from "./connection-string";
import { describeError } from "./errors";
import { fire } from "./fire";
import type { LastSync, PluginData } from "./state";
import { STRINGS } from "./strings";
import { SyncClient } from "./sync/client";
import { SyncRunner } from "./sync/runner";
import { selectedFiles } from "./sync/tree";
import type { PreparedSync } from "./sync/types";
import { MassRemoveModal } from "./ui/mass-modal";
import { progressMessage, SyncModal } from "./ui/sync-modal";

const TRAILING_SLASH = /\/$/;

export interface FlowHost {
	app: App;
	version: string;
	data: PluginData;
	setLastSync: (lastSync: LastSync) => Promise<void>;
	isBusy: () => boolean;
	setBusy: (busy: boolean) => void;
	openSettings: () => void;
}

export function createClient(host: FlowHost): SyncClient | null {
	const key = readKey(host.app);
	const connection = host.data.connection;
	if (!(key && connection)) {
		return null;
	}
	return new SyncClient({
		baseUrl: connection.url.replace(TRAILING_SLASH, ""),
		key,
		pluginVersion: host.version,
		transport,
	});
}

export function connectionFromString(raw: string) {
	return parseConnectionString(raw.trim());
}

class ReviewSession {
	private readonly host: FlowHost;
	private readonly runner: SyncRunner;
	private readonly modal: SyncModal;
	private prepared: PreparedSync | null = null;
	private running = false;
	private dismissed = false;
	private preparing = false;

	constructor(host: FlowHost, client: SyncClient) {
		this.host = host;
		this.runner = new SyncRunner({ client, vault: createVaultPort(host.app) });
		this.modal = new SyncModal(host.app, {
			onSync: (approve) => fire(this.execute(approve)),
			onDismiss: () => fire(this.dismiss()),
			onRetry: () => fire(this.start()),
			onOpenSettings: () => {
				this.modal.close();
				host.openSettings();
			},
		});
	}

	open() {
		this.modal.open();
		fire(this.start());
	}

	private async dismiss() {
		this.dismissed = true;
		if (this.running) {
			return;
		}
		const prepared = this.prepared;
		this.prepared = null;
		if (prepared) {
			await this.release(prepared);
			this.host.setBusy(false);
			return;
		}
		if (!this.preparing) {
			this.host.setBusy(false);
		}
	}

	private async release(prepared: PreparedSync) {
		if (!(await this.runner.cancel(prepared))) {
			new Notice(STRINGS.notices.releaseFailed);
		}
	}

	private async start() {
		this.host.setBusy(true);
		this.preparing = true;
		this.modal.show({ kind: "loading", message: STRINGS.preview.preparing });
		const files = selectedFiles(
			createVaultPort(this.host.app).listMarkdown(),
			this.host.data.selection,
		);
		const prepared = await this.runner.prepare(files, (progress) =>
			this.modal.show({
				kind: "loading",
				message: `${STRINGS.preview.preparing} ${progress.done}/${progress.total}`,
			}),
		);
		this.preparing = false;
		if (this.dismissed) {
			if (prepared.ok) {
				await this.release(prepared.value);
			}
			this.host.setBusy(false);
			return;
		}
		if (!prepared.ok) {
			this.host.setBusy(false);
			this.modal.show({ kind: "error", error: describeError(prepared.error) });
			return;
		}
		this.prepared = prepared.value;
		this.modal.show({ kind: "preview", prepared: prepared.value });
	}

	private async execute(approveRemovals: boolean) {
		const prepared = this.prepared;
		if (!prepared) {
			return;
		}
		let confirmMass = false;
		if (approveRemovals && prepared.plan.massRemove) {
			confirmMass = await new Promise<boolean>((resolve) =>
				new MassRemoveModal(
					this.host.app,
					prepared.plan.remove.length,
					resolve,
				).open(),
			);
			if (!confirmMass) {
				return;
			}
		}
		this.running = true;
		this.modal.show({ kind: "running", message: STRINGS.progress.start });
		const outcome = await this.runner.execute(
			prepared,
			{ approveRemovals, confirmMass },
			(progress) =>
				this.modal.show({
					kind: "running",
					message: progressMessage(progress),
				}),
		);
		this.running = false;
		this.prepared = null;
		await this.host.setLastSync({
			at: Date.now(),
			ok: !(outcome.fatal || outcome.finishError || outcome.finishFailed),
			errorCode:
				outcome.fatal?.code ??
				outcome.finishError ??
				(outcome.finishFailed ? "finish_failed" : undefined),
		});
		this.host.setBusy(false);
		if (this.dismissed) {
			return;
		}
		if (
			outcome.fatal &&
			outcome.pushed + outcome.updated + outcome.retried + outcome.removed === 0
		) {
			this.modal.show({ kind: "error", error: describeError(outcome.fatal) });
			return;
		}
		this.modal.show({ kind: "result", outcome });
	}
}

export function startReview(host: FlowHost) {
	if (host.isBusy()) {
		new Notice(STRINGS.notices.busy);
		return;
	}
	const client = createClient(host);
	if (!client) {
		new Notice(STRINGS.notices.notConnected);
		return;
	}
	const files = selectedFiles(
		createVaultPort(host.app).listMarkdown(),
		host.data.selection,
	);
	if (files.length === 0 && !host.data.lastSync) {
		new Notice(STRINGS.notices.nothingSelected);
		return;
	}
	new ReviewSession(host, client).open();
}
