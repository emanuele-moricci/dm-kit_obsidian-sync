import { emptySelection } from "./sync/selection";
import type { SelectionRules } from "./sync/types";

export const SECRET_ID = "dm-kit-sync-key";

export interface StoredConnection {
	url: string;
	name?: string;
	campaign?: string | null;
}

export interface LastSync {
	at: number;
	ok: boolean;
	errorCode?: string;
}

export interface PluginData {
	connection: StoredConnection | null;
	selection: SelectionRules;
	expanded: string[];
	lastSync: LastSync | null;
}

export function defaultData(): PluginData {
	return {
		connection: null,
		selection: emptySelection(),
		expanded: [],
		lastSync: null,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function booleanRecord(value: unknown): Record<string, boolean> {
	if (!isRecord(value)) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, boolean] => typeof entry[1] === "boolean",
		),
	);
}

export function normalizeData(raw: unknown): PluginData {
	const base = defaultData();
	if (!isRecord(raw)) {
		return base;
	}
	const connection = raw.connection;
	if (isRecord(connection) && typeof connection.url === "string") {
		base.connection = {
			url: connection.url,
			name: typeof connection.name === "string" ? connection.name : undefined,
			campaign:
				typeof connection.campaign === "string" || connection.campaign === null
					? connection.campaign
					: undefined,
		};
	}
	if (isRecord(raw.selection)) {
		base.selection = {
			folders: booleanRecord(raw.selection.folders),
			files: booleanRecord(raw.selection.files),
		};
	}
	if (Array.isArray(raw.expanded)) {
		base.expanded = raw.expanded.filter(
			(entry): entry is string => typeof entry === "string",
		);
	}
	const lastSync = raw.lastSync;
	if (
		isRecord(lastSync) &&
		typeof lastSync.at === "number" &&
		typeof lastSync.ok === "boolean"
	) {
		base.lastSync = {
			at: lastSync.at,
			ok: lastSync.ok,
			errorCode:
				typeof lastSync.errorCode === "string" ? lastSync.errorCode : undefined,
		};
	}
	return base;
}
