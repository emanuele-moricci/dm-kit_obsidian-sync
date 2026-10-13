export const CONNECTION_STRING_PREFIX = "dmk1.";

export type ConnectionStringErrorCode =
	| "invalid_prefix"
	| "invalid_encoding"
	| "invalid_payload"
	| "insecure_url";

export interface ConnectionCredentials {
	url: string;
	key: string;
}

export type ParsedConnectionString =
	| { ok: true; value: ConnectionCredentials }
	| { ok: false; code: ConnectionStringErrorCode };

const BASE64_URL_DASH = /-/g;
const BASE64_URL_UNDERSCORE = /_/g;
const TRAILING_SLASHES = /\/+$/;
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1"]);

function decodeBase64Url(input: string): string | null {
	const padded = input
		.replace(BASE64_URL_DASH, "+")
		.replace(BASE64_URL_UNDERSCORE, "/")
		.padEnd(Math.ceil(input.length / 4) * 4, "=");
	try {
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

function isAllowedUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		if (url.protocol === "https:") {
			return true;
		}
		return url.protocol === "http:" && LOCALHOST_HOSTS.has(url.hostname);
	} catch {
		return false;
	}
}

export function parseConnectionString(input: string): ParsedConnectionString {
	const trimmed = input.trim();
	if (!trimmed.startsWith(CONNECTION_STRING_PREFIX)) {
		return { ok: false, code: "invalid_prefix" };
	}

	const decoded = decodeBase64Url(
		trimmed.slice(CONNECTION_STRING_PREFIX.length),
	);
	if (decoded === null) {
		return { ok: false, code: "invalid_encoding" };
	}

	let payload: unknown;
	try {
		payload = JSON.parse(decoded);
	} catch {
		return { ok: false, code: "invalid_encoding" };
	}

	if (typeof payload !== "object" || payload === null) {
		return { ok: false, code: "invalid_payload" };
	}

	const { url, key } = payload as Record<string, unknown>;
	if (typeof url !== "string" || typeof key !== "string" || key.length === 0) {
		return { ok: false, code: "invalid_payload" };
	}

	if (!isAllowedUrl(url)) {
		return { ok: false, code: "insecure_url" };
	}

	return { ok: true, value: { url: url.replace(TRAILING_SLASHES, ""), key } };
}
