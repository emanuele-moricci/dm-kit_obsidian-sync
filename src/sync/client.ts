import {
	API_PREFIX,
	type ApiErrorCode,
	type ErrorEnvelope,
	type FinishRequest,
	type FinishResponse,
	PLUGIN_VERSION_HEADER,
	type PlanRequest,
	type PlanResponse,
	type PushRequest,
	type PushResponse,
	type RemoveRequest,
	type RemoveResponse,
	type StatusResponse,
} from "../contract/types";
import type {
	ClientError,
	ClientResult,
	HttpRequest,
	HttpResponse,
	Transport,
} from "./types";

const KNOWN_API_CODES: readonly ApiErrorCode[] = [
	"unauthorized",
	"forbidden",
	"campaign_archived",
	"run_conflict",
	"run_expired",
	"rate_limited",
	"payload_too_large",
	"upgrade_required",
	"invalid_request",
	"server_error",
];

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

export interface SyncClientConfig {
	baseUrl: string;
	key: string;
	pluginVersion: string;
	transport: Transport;
}

function isApiCode(value: unknown): value is ApiErrorCode {
	return (
		typeof value === "string" &&
		(KNOWN_API_CODES as readonly string[]).includes(value)
	);
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function toClientError(response: HttpResponse): ClientError {
	const envelope = parseJson(response.text) as ErrorEnvelope | undefined;
	const raw = envelope?.error;
	if (raw && isApiCode(raw.code)) {
		return {
			code: raw.code,
			status: response.status,
			message: raw.message,
			retryAfterSeconds: raw.retryAfterSeconds,
			details: raw.details,
		};
	}
	return {
		code: response.status >= 500 ? "server_error" : "invalid_response",
		status: response.status,
	};
}

export class SyncClient {
	private readonly config: SyncClientConfig;

	constructor(config: SyncClientConfig) {
		this.config = config;
	}

	plan(body: PlanRequest) {
		return this.call<PlanResponse>("POST", "plan", body);
	}

	push(body: PushRequest) {
		return this.call<PushResponse>("POST", "push", body);
	}

	remove(body: RemoveRequest) {
		return this.call<RemoveResponse>("POST", "remove", body);
	}

	finish(body: FinishRequest) {
		return this.call<FinishResponse>("POST", "finish", body);
	}

	status() {
		return this.call<StatusResponse>("GET", "status");
	}

	private async call<Value>(
		method: HttpRequest["method"],
		route: string,
		body?: unknown,
	): Promise<ClientResult<Value>> {
		const request: HttpRequest = {
			url: `${this.config.baseUrl}${API_PREFIX}/${route}`,
			method,
			headers: {
				Authorization: `Bearer ${this.config.key}`,
				[PLUGIN_VERSION_HEADER]: this.config.pluginVersion,
			},
		};
		if (body !== undefined) {
			request.headers["Content-Type"] = "application/json";
			request.body = JSON.stringify(body);
		}
		let response: HttpResponse;
		try {
			response = await this.config.transport(request);
		} catch {
			return { ok: false, error: { code: "network", status: 0 } };
		}
		if (response.status < HTTP_OK_MIN || response.status > HTTP_OK_MAX) {
			return { ok: false, error: toClientError(response) };
		}
		const value = parseJson(response.text);
		if (value === undefined) {
			return {
				ok: false,
				error: { code: "invalid_response", status: response.status },
			};
		}
		return { ok: true, value: value as Value };
	}
}
