import type {
	ErrorEnvelope,
	FinishRequest,
	PlanRequest,
	PlanResponse,
	PushRequest,
	PushResponse,
	RemoveRequest,
	RemoveResponse,
	StatusResponse,
} from "./types";

const SHA = "a".repeat(64);

export const PLAN_REQUEST_EXAMPLE: PlanRequest = {
	manifest: [{ path: "Campaign/NPCs/Strahd.md", size: 24, sha256: SHA }],
};

export const PLAN_RESPONSE_EXAMPLE: PlanResponse = {
	runId: "run_1",
	expiresAt: 1_800_000_000_000,
	add: ["Campaign/NPCs/Strahd.md"],
	update: [],
	retry: [],
	remove: [],
	unchangedCount: 0,
	skipped: [{ path: "Maps/big.md", reason: "too_large" }],
	massRemove: false,
	quota: {
		plan: "free",
		limitBytes: 100,
		usedBytes: 10,
		afterBytes: 34,
		limitNotes: 500,
		usedNotes: 3,
		afterNotes: 4,
	},
	campaign: { name: "Curse of Strahd" },
	connection: { name: "Obsidian vault" },
};

export const PUSH_REQUEST_EXAMPLE: PushRequest = {
	runId: "run_1",
	files: [
		{ path: "Campaign/NPCs/Strahd.md", sha256: SHA, content: "# Strahd" },
	],
};

export const PUSH_RESPONSE_EXAMPLE: PushResponse = {
	results: [
		{ path: "Campaign/NPCs/Strahd.md", status: "accepted" },
		{ path: "b.md", status: "rejected", code: "in_progress" },
	],
};

export const REMOVE_REQUEST_EXAMPLE: RemoveRequest = {
	runId: "run_1",
	paths: ["old.md"],
	confirmMass: true,
};

export const REMOVE_RESPONSE_EXAMPLE: RemoveResponse = {
	results: [
		{ path: "old.md", status: "removed" },
		{ path: "x.md", status: "rejected", code: "not_in_plan" },
	],
};

export const FINISH_REQUEST_EXAMPLE: FinishRequest = {
	runId: "run_1",
	error: { code: "push_incomplete" },
};

export const STATUS_RESPONSE_EXAMPLE: StatusResponse = {
	quota: {
		plan: "free",
		limitBytes: 100,
		usedBytes: 40,
		limitNotes: 500,
		usedNotes: 3,
	},
	lastSyncAt: 1_800_000_000_000,
	lastError: null,
	counts: { total: 3, processed: 1, processing: 1, error: 1 },
	errors: [{ path: "a.md", error: "failed" }],
	connection: { name: "Obsidian vault" },
};

export const ERROR_ENVELOPE_EXAMPLE: ErrorEnvelope = {
	error: {
		code: "rate_limited",
		retryAfterSeconds: 30,
		details: { reason: "plan" },
	},
};
