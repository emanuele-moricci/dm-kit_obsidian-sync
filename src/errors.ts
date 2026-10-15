import { STRINGS } from "./strings";
import type { ClientError } from "./sync/types";

export type ErrorAction =
	| "reconnect"
	| "update_plugin"
	| "retry"
	| "review_selection"
	| "none";

export interface DescribedError {
	message: string;
	action: ErrorAction;
}

export type DescribableError =
	| ClientError
	| {
			code: "too_many_files";
			details?: undefined;
			retryAfterSeconds?: undefined;
	  }
	| {
			code: "unreadable_notes";
			paths: string[];
			details?: undefined;
			retryAfterSeconds?: undefined;
	  };

function minVersionOf(error: DescribableError): string | undefined {
	const value = error.details?.minVersion;
	return typeof value === "string" ? value : undefined;
}

export function describeError(error: DescribableError): DescribedError {
	const text = STRINGS.errors;
	switch (error.code) {
		case "unauthorized":
		case "forbidden":
			return { message: text[error.code], action: "reconnect" };
		case "upgrade_required":
			return {
				message: text.upgrade_required(minVersionOf(error)),
				action: "update_plugin",
			};
		case "rate_limited":
			return {
				message: text.rate_limited(error.retryAfterSeconds),
				action: "retry",
			};
		case "unreadable_notes":
			return {
				message: text.unreadable_notes(error.paths),
				action: "retry",
			};
		case "payload_too_large":
		case "too_many_files":
			return { message: text[error.code], action: "review_selection" };
		case "invalid_request":
			return error.details?.reason === "confirm_mass_required"
				? { message: text.confirm_mass_required, action: "retry" }
				: { message: text.invalid_request, action: "update_plugin" };
		case "campaign_archived":
			return { message: text.campaign_archived, action: "retry" };
		case "campaign_read_only":
			return { message: text.campaign_read_only, action: "retry" };
		case "run_conflict":
		case "run_expired":
		case "server_error":
		case "invalid_response":
		case "network":
			return { message: text[error.code], action: "retry" };
		default:
			return { message: text.server_error, action: "retry" };
	}
}
