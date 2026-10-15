import {
	MAX_FILE_BYTES,
	MAX_REMOVE_PATHS,
	PUSH_BATCH_BYTES,
	PUSH_BATCH_FILES,
} from "../contract/limits";
import type {
	FinishErrorCode,
	PushFile,
	PushResponse,
} from "../contract/types";
import type { SyncClient } from "./client";
import { byteLength, sha256Hex } from "./hash";
import { buildManifest } from "./manifest";
import { callWithRetry, defaultSleep, type RetryHooks } from "./retry";
import type {
	ClientError,
	ClientResult,
	ExecuteOptions,
	ExecuteProgress,
	ManifestProgress,
	PreparedSync,
	SyncOutcome,
	VaultFile,
	VaultPort,
} from "./types";

export type PrepareResult =
	| { ok: true; value: PreparedSync }
	| {
			ok: false;
			error:
				| ClientError
				| { code: "too_many_files" }
				| { code: "unreadable_notes"; paths: string[] };
	  };

export interface SyncRunnerDeps {
	client: SyncClient;
	vault: VaultPort;
	sleep?: (ms: number) => Promise<void>;
}

const FINISH_ATTEMPTS = 2;
const MAX_FAILED_UPLOADS = 5;
const SPLITTABLE_CODES: ReadonlySet<string> = new Set([
	"server_error",
	"invalid_response",
	"payload_too_large",
]);
const TRANSIENT_REJECTIONS: ReadonlySet<string> = new Set([
	"allowance_exhausted",
	"hash_mismatch",
	"upload_failed",
]);

interface PendingFile {
	path: string;
	kind: "add" | "update" | "retry";
}

interface PushedFile extends PendingFile {
	file: PushFile;
	bytes: number;
}

function emptyOutcome(prepared: PreparedSync): SyncOutcome {
	return {
		pushed: 0,
		updated: 0,
		retried: 0,
		removed: 0,
		unchanged: prepared.plan.unchangedCount,
		skipped: prepared.plan.skipped,
		rejected: [],
		removalSkipped: false,
		incomplete: false,
		finishFailed: false,
		fatal: null,
		finishError: null,
	};
}

function chunk<Item>(items: readonly Item[], size: number): Item[][] {
	const chunks: Item[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

export class SyncRunner {
	private readonly deps: SyncRunnerDeps;
	private failedUploads = 0;

	constructor(deps: SyncRunnerDeps) {
		this.deps = deps;
	}

	private hooks(onWait?: (seconds: number) => void): RetryHooks {
		return { sleep: this.deps.sleep ?? defaultSleep, onWait };
	}

	async prepare(
		files: readonly VaultFile[],
		onProgress?: (progress: ManifestProgress) => void,
	): Promise<PrepareResult> {
		const built = await buildManifest(this.deps.vault, files, onProgress);
		if (built.unreadable.length > 0) {
			return {
				ok: false,
				error: { code: "unreadable_notes", paths: built.unreadable },
			};
		}
		if (built.overLimit) {
			return { ok: false, error: { code: "too_many_files" } };
		}
		const plan = await callWithRetry(
			() => this.deps.client.plan({ manifest: built.entries }),
			this.hooks(),
		);
		if (!plan.ok) {
			return plan;
		}
		return {
			ok: true,
			value: { plan: plan.value, manifest: built.entries },
		};
	}

	private replacementRejected(
		prepared: PreparedSync,
		outcome: SyncOutcome,
	): boolean {
		if (prepared.plan.remove.length === 0) {
			return false;
		}
		const added = new Set(prepared.plan.add);
		return outcome.rejected.some(
			(entry) => added.has(entry.path) && TRANSIENT_REJECTIONS.has(entry.code),
		);
	}

	async cancel(prepared: PreparedSync): Promise<boolean> {
		return await this.finishRun({ runId: prepared.plan.runId });
	}

	async execute(
		prepared: PreparedSync,
		options: ExecuteOptions,
		onProgress?: (progress: ExecuteProgress) => void,
	): Promise<SyncOutcome> {
		const outcome = emptyOutcome(prepared);
		this.failedUploads = 0;
		const pending = this.pendingFiles(prepared);
		const pushOk = await this.pushAll(prepared, pending, outcome, onProgress);

		if (pushOk && this.replacementRejected(prepared, outcome)) {
			outcome.removalSkipped = true;
		} else if (pushOk) {
			await this.removeAll(prepared, options, outcome, onProgress);
		}

		const finishError = this.resolveFinishError(prepared, outcome);
		outcome.finishError = finishError;
		onProgress?.({ phase: "finish", done: 0, total: 1 });
		outcome.finishFailed = !(await this.finishRun({
			runId: prepared.plan.runId,
			error: finishError ? { code: finishError } : undefined,
		}));
		return outcome;
	}

	private async finishRun(
		body: Parameters<SyncClient["finish"]>[0],
	): Promise<boolean> {
		for (let attempt = 0; attempt < FINISH_ATTEMPTS; attempt++) {
			const response = await this.deps.client.finish(body);
			if (response.ok) {
				return true;
			}
			const code = response.error.code;
			if (code === "run_expired" || code === "run_conflict") {
				return true;
			}
			if (code === "unauthorized" || code === "forbidden") {
				return false;
			}
		}
		return false;
	}

	private pendingFiles(prepared: PreparedSync): PendingFile[] {
		const { plan } = prepared;
		return [
			...plan.add.map((path) => ({ path, kind: "add" as const })),
			...plan.update.map((path) => ({ path, kind: "update" as const })),
			...plan.retry.map((path) => ({ path, kind: "retry" as const })),
		];
	}

	private async loadFile(
		item: PendingFile,
		outcome: SyncOutcome,
	): Promise<PushedFile | null> {
		let content: string;
		try {
			content = await this.deps.vault.read(item.path);
		} catch {
			outcome.rejected.push({ path: item.path, code: "invalid_content" });
			return null;
		}
		const bytes = byteLength(content);
		if (bytes > MAX_FILE_BYTES) {
			outcome.rejected.push({ path: item.path, code: "too_large" });
			return null;
		}
		return {
			...item,
			bytes,
			file: { path: item.path, sha256: await sha256Hex(content), content },
		};
	}

	private async pushAll(
		prepared: PreparedSync,
		pending: PendingFile[],
		outcome: SyncOutcome,
		onProgress?: (progress: ExecuteProgress) => void,
	): Promise<boolean> {
		let done = 0;
		let batch: PushedFile[] = [];
		let batchBytes = 0;
		const hooks = this.hooks((seconds) =>
			onProgress?.({
				phase: "wait",
				done,
				total: pending.length,
				waitSeconds: seconds,
			}),
		);
		onProgress?.({ phase: "push", done, total: pending.length });
		const flush = async (): Promise<boolean> => {
			if (batch.length === 0) {
				return true;
			}
			const current = batch;
			batch = [];
			batchBytes = 0;
			const ok = await this.pushBatch(prepared, current, outcome, hooks);
			done += current.length;
			onProgress?.({ phase: "push", done, total: pending.length });
			return ok;
		};
		for (const item of pending) {
			const loaded = await this.loadFile(item, outcome);
			if (!loaded) {
				done += 1;
				continue;
			}
			if (
				(batch.length >= PUSH_BATCH_FILES ||
					batchBytes + loaded.bytes > PUSH_BATCH_BYTES) &&
				!(await flush())
			) {
				return false;
			}
			batch.push(loaded);
			batchBytes += loaded.bytes;
		}
		return flush();
	}

	private async pushBatch(
		prepared: PreparedSync,
		batch: PushedFile[],
		outcome: SyncOutcome,
		hooks: RetryHooks,
	): Promise<boolean> {
		const response = await callWithRetry(
			() =>
				this.deps.client.push({
					runId: prepared.plan.runId,
					files: batch.map((entry) => entry.file),
				}),
			hooks,
		);
		if (response.ok) {
			this.recordPushResults(batch, response.value.results, outcome);
			return true;
		}
		if (!SPLITTABLE_CODES.has(response.error.code)) {
			this.fail(outcome, response);
			return false;
		}
		if (batch.length > 1) {
			return await this.pushHalves(prepared, batch, outcome, hooks);
		}
		return this.dropFile(batch, outcome, response);
	}

	private async pushHalves(
		prepared: PreparedSync,
		batch: PushedFile[],
		outcome: SyncOutcome,
		hooks: RetryHooks,
	): Promise<boolean> {
		const middle = Math.ceil(batch.length / 2);
		for (const half of [batch.slice(0, middle), batch.slice(middle)]) {
			if (!(await this.pushBatch(prepared, half, outcome, hooks))) {
				return false;
			}
		}
		return true;
	}

	private dropFile(
		batch: PushedFile[],
		outcome: SyncOutcome,
		response: Extract<ClientResult<unknown>, { ok: false }>,
	): boolean {
		const [only] = batch;
		if (!only) {
			return true;
		}
		if (response.error.code === "payload_too_large") {
			outcome.rejected.push({ path: only.path, code: "too_large" });
			return true;
		}
		this.failedUploads += 1;
		if (this.failedUploads > MAX_FAILED_UPLOADS) {
			this.fail(outcome, response);
			return false;
		}
		outcome.rejected.push({ path: only.path, code: "upload_failed" });
		return true;
	}

	private recordPushResults(
		batch: PushedFile[],
		results: PushResponse["results"],
		outcome: SyncOutcome,
	) {
		const kinds = new Map(batch.map((entry) => [entry.path, entry.kind]));
		for (const result of results) {
			if (result.status === "accepted") {
				const kind = kinds.get(result.path);
				if (kind === "update") {
					outcome.updated += 1;
				} else if (kind === "retry") {
					outcome.retried += 1;
				} else {
					outcome.pushed += 1;
				}
			} else {
				outcome.rejected.push({
					path: result.path,
					code: result.code,
				});
			}
		}
	}

	private async removeAll(
		prepared: PreparedSync,
		options: ExecuteOptions,
		outcome: SyncOutcome,
		onProgress?: (progress: ExecuteProgress) => void,
	) {
		const { plan } = prepared;
		if (plan.remove.length === 0) {
			return;
		}
		if (!options.approveRemovals || (plan.massRemove && !options.confirmMass)) {
			outcome.removalSkipped = true;
			return;
		}
		let done = 0;
		for (const paths of chunk(plan.remove, MAX_REMOVE_PATHS)) {
			const response = await callWithRetry(
				() =>
					this.deps.client.remove({
						runId: plan.runId,
						paths,
						confirmMass: plan.massRemove ? true : undefined,
					}),
				this.hooks((seconds) =>
					onProgress?.({
						phase: "wait",
						done,
						total: plan.remove.length,
						waitSeconds: seconds,
					}),
				),
			);
			if (!response.ok) {
				this.fail(outcome, response);
				return;
			}
			outcome.removed += response.value.results.filter(
				(result) => result.status === "removed",
			).length;
			done += paths.length;
			onProgress?.({ phase: "remove", done, total: plan.remove.length });
		}
	}

	private fail(
		outcome: SyncOutcome,
		response: Extract<ClientResult<unknown>, { ok: false }>,
	) {
		outcome.fatal = response.error;
		outcome.incomplete = true;
	}

	private resolveFinishError(
		prepared: PreparedSync,
		outcome: SyncOutcome,
	): FinishErrorCode | null {
		if (outcome.incomplete) {
			return outcome.fatal?.code === "run_expired" ||
				outcome.fatal?.code === "unauthorized"
				? null
				: "push_incomplete";
		}
		if (outcome.rejected.some((entry) => entry.code === "upload_failed")) {
			return "push_incomplete";
		}
		if (outcome.removalSkipped) {
			return "remove_not_confirmed";
		}
		const quotaHit =
			prepared.plan.skipped.some((entry) => entry.reason === "quota") ||
			outcome.rejected.some((entry) => entry.code === "allowance_exhausted");
		return quotaHit ? "quota" : null;
	}
}
