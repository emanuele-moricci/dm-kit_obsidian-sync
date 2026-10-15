import type { ClientError, ClientResult } from "./types";

const TRANSIENT_CODES: ReadonlySet<string> = new Set([
	"server_error",
	"network",
	"invalid_response",
	"rate_limited",
]);
const BACKOFF_MS = [1000, 3000, 8000] as const;
const MS_PER_SECOND = 1000;
const MAX_RATE_LIMIT_WAIT_SECONDS = 90;

export const RETRY_ATTEMPTS = 4;

export interface RetryHooks {
	sleep: (ms: number) => Promise<void>;
	onWait?: (seconds: number) => void;
}

export function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransient(error: ClientError): boolean {
	return TRANSIENT_CODES.has(error.code);
}

function waitFor(error: ClientError, attempt: number): number | null {
	if (error.code === "rate_limited") {
		const seconds = error.retryAfterSeconds ?? 5;
		return seconds > MAX_RATE_LIMIT_WAIT_SECONDS
			? null
			: Math.max(1, seconds) * MS_PER_SECOND;
	}
	return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 0;
}

export async function callWithRetry<Value>(
	call: () => Promise<ClientResult<Value>>,
	hooks: RetryHooks,
	attempts = RETRY_ATTEMPTS,
): Promise<ClientResult<Value>> {
	let result = await call();
	for (let attempt = 1; attempt < attempts; attempt++) {
		if (result.ok || !isTransient(result.error)) {
			return result;
		}
		const wait = waitFor(result.error, attempt - 1);
		if (wait === null) {
			return result;
		}
		hooks.onWait?.(Math.ceil(wait / MS_PER_SECOND));
		await hooks.sleep(wait);
		result = await call();
	}
	return result;
}
