import type {
	ApiErrorCode,
	ManifestEntry,
	PlanResponse,
	PushRejectionCode,
	SkipReason,
	StatusResponse,
} from "../contract/types";

export interface VaultFile {
	path: string;
	size: number;
	mtime: number;
}

export interface VaultPort {
	listMarkdown: () => VaultFile[];
	read: (path: string) => Promise<string>;
}

export interface HttpRequest {
	url: string;
	method: "GET" | "POST";
	headers: Record<string, string>;
	body?: string;
}

export interface HttpResponse {
	status: number;
	text: string;
}

export type Transport = (request: HttpRequest) => Promise<HttpResponse>;

export type ClientErrorCode = ApiErrorCode | "network" | "invalid_response";

export interface ClientError {
	code: ClientErrorCode;
	status: number;
	message?: string;
	retryAfterSeconds?: number;
	details?: Record<string, unknown>;
}

export type ClientResult<Value> =
	| { ok: true; value: Value }
	| { ok: false; error: ClientError };

export interface SelectionRules {
	folders: Record<string, boolean>;
	files: Record<string, boolean>;
}

export type CheckState = "checked" | "unchecked" | "indeterminate";

export interface TreeNode {
	type: "folder" | "file";
	name: string;
	path: string;
	bytes: number;
	count: number;
	selectedBytes: number;
	selectedCount: number;
	state: CheckState;
	children: TreeNode[];
}

export interface BuiltManifest {
	entries: ManifestEntry[];
	bytes: number;
}

export interface ManifestProgress {
	done: number;
	total: number;
}

export interface PreparedSync {
	plan: PlanResponse;
	manifest: ManifestEntry[];
}

export interface SyncOutcome {
	pushed: number;
	updated: number;
	retried: number;
	removed: number;
	unchanged: number;
	skipped: Array<{ path: string; reason: SkipReason }>;
	rejected: Array<{ path: string; code: PushRejectionCode | "too_large" }>;
	removalSkipped: boolean;
	incomplete: boolean;
	finishFailed: boolean;
	fatal: ClientError | null;
	finishError: "push_incomplete" | "remove_not_confirmed" | "quota" | null;
}

export interface ExecuteOptions {
	approveRemovals: boolean;
	confirmMass: boolean;
}

export interface ExecuteProgress {
	phase: "push" | "remove" | "finish";
	done: number;
	total: number;
}

export type StatusSnapshot = StatusResponse;
