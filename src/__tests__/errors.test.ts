import { describe, expect, test } from "vitest";
import { describeError } from "../errors";
import { normalizeData } from "../state";
import { formatBytes, formatRelativeTime } from "../ui/format";

describe("describeError", () => {
	test("auth failures ask to reconnect", () => {
		expect(describeError({ code: "unauthorized", status: 401 }).action).toBe(
			"reconnect",
		);
		expect(describeError({ code: "forbidden", status: 403 }).action).toBe(
			"reconnect",
		);
	});

	test("an archived campaign explains that syncing is paused", () => {
		const described = describeError({
			code: "campaign_archived",
			status: 403,
		});
		expect(described.message).toContain("archived");
		expect(described.action).toBe("retry");
	});

	test("upgrade names the minimum version", () => {
		const described = describeError({
			code: "upgrade_required",
			status: 426,
			details: { minVersion: "0.2.0" },
		});
		expect(described.action).toBe("update_plugin");
		expect(described.message).toContain("0.2.0");
	});

	test("rate limits mention the wait", () => {
		const described = describeError({
			code: "rate_limited",
			status: 429,
			retryAfterSeconds: 42,
		});
		expect(described.message).toContain("42");
		expect(described.action).toBe("retry");
	});

	test("mass removal confirmation is distinct from a bad request", () => {
		const confirm = describeError({
			code: "invalid_request",
			status: 400,
			details: { reason: "confirm_mass_required" },
		});
		expect(confirm.action).toBe("retry");
		expect(describeError({ code: "invalid_request", status: 400 }).action).toBe(
			"update_plugin",
		);
	});

	test("unreadable notes name the files and ask to retry", () => {
		const described = describeError({
			code: "unreadable_notes",
			paths: ["a.md", "b.md", "c.md", "d.md"],
		});
		expect(described.action).toBe("retry");
		expect(described.message).toContain("a.md, b.md, c.md, …");
	});

	test("selection problems send the user back to the tree", () => {
		expect(describeError({ code: "too_many_files" }).action).toBe(
			"review_selection",
		);
		expect(
			describeError({ code: "payload_too_large", status: 413 }).action,
		).toBe("review_selection");
	});
});

describe("normalizeData", () => {
	test("falls back to defaults for junk", () => {
		expect(normalizeData(null).connection).toBeNull();
		expect(normalizeData({ selection: "x", expanded: 3 }).selection).toEqual({
			folders: {},
			files: {},
		});
	});

	test("keeps valid stored values only", () => {
		const data = normalizeData({
			connection: { url: "https://x.convex.site", name: "V" },
			selection: { folders: { a: true, b: "yes" }, files: { "c.md": false } },
			expanded: ["a", 1],
			lastSync: { at: 5, ok: true },
		});
		expect(data.connection?.name).toBe("V");
		expect(data.selection).toEqual({
			folders: { a: true },
			files: { "c.md": false },
		});
		expect(data.expanded).toEqual(["a"]);
		expect(data.lastSync).toEqual({ at: 5, ok: true, errorCode: undefined });
	});
});

describe("format", () => {
	test("bytes", () => {
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
	});

	test("relative time", () => {
		expect(formatRelativeTime(0, 30_000)).toBe("just now");
		expect(formatRelativeTime(0, 5 * 60_000)).toBe("5 min ago");
		expect(formatRelativeTime(0, 3 * 3_600_000)).toBe("3 h ago");
		expect(formatRelativeTime(0, 2 * 86_400_000)).toBe("2 d ago");
	});
});
