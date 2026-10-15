export const PLUGIN_VERSION_HEADER = "X-DMK-Plugin-Version";
export const API_PREFIX = "/sync/v1";

export type SkipReason =
	| "not_markdown"
	| "empty"
	| "too_large"
	| "quota"
	| "path_invalid"
	| "indexing";

export type PushRejectionCode =
	| "hash_mismatch"
	| "path_invalid"
	| "invalid_content"
	| "allowance_exhausted"
	| "in_progress";

export type RemoveRejectionCode = "not_in_plan";

export type FinishErrorCode =
	| "push_incomplete"
	| "remove_not_confirmed"
	| "quota";

export type ApiErrorCode =
	| "unauthorized"
	| "forbidden"
	| "campaign_archived"
	| "run_conflict"
	| "run_expired"
	| "rate_limited"
	| "payload_too_large"
	| "upgrade_required"
	| "invalid_request"
	| "server_error";

export interface ManifestEntry {
	path: string;
	size: number;
	sha256: string;
}

export interface PlanRequest {
	manifest: ManifestEntry[];
}

export interface SkippedEntry {
	path: string;
	reason: SkipReason;
}

export type PlanTier = "free" | "pro";

export interface Quota {
	plan: PlanTier;
	limitBytes: number;
	usedBytes: number;
	afterBytes: number;
	limitNotes: number;
	usedNotes: number;
	afterNotes: number;
}

export interface PlanResponse {
	runId: string;
	expiresAt: number;
	add: string[];
	update: string[];
	retry: string[];
	remove: string[];
	unchangedCount: number;
	skipped: SkippedEntry[];
	massRemove: boolean;
	quota: Quota;
	campaign: { name: string | null };
	connection: { name: string };
}

export interface PushFile {
	path: string;
	sha256: string;
	content: string;
}

export interface PushRequest {
	runId: string;
	files: PushFile[];
}

export type PushResult =
	| { path: string; status: "accepted" }
	| { path: string; status: "rejected"; code: PushRejectionCode };

export interface PushResponse {
	results: PushResult[];
}

export interface RemoveRequest {
	runId: string;
	paths: string[];
	confirmMass?: boolean;
}

export type RemoveResult =
	| { path: string; status: "removed" }
	| { path: string; status: "rejected"; code: RemoveRejectionCode };

export interface RemoveResponse {
	results: RemoveResult[];
}

export interface FinishRequest {
	runId: string;
	error?: { code: FinishErrorCode };
}

export interface FinishResponse {
	ok: true;
}

export interface StatusResponse {
	quota: Omit<Quota, "afterBytes" | "afterNotes">;
	lastSyncAt: number | null;
	lastError: { code: string; message?: string; at: number } | null;
	counts: {
		total: number;
		processed: number;
		processing: number;
		error: number;
	};
	errors: Array<{ path: string; error: string | null }>;
	connection: { name: string };
}

export interface ErrorEnvelope {
	error: {
		code: ApiErrorCode;
		message?: string;
		retryAfterSeconds?: number;
		details?: Record<string, unknown>;
	};
}
