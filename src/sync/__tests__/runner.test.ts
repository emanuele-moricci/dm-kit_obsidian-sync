import { describe, expect, test } from "vitest";
import {
	MAX_MANIFEST_ENTRIES,
	MAX_PUSH_FILES,
	MAX_REMOVE_PATHS,
} from "../../contract/limits";
import { SyncClient } from "../client";
import { SyncRunner } from "../runner";
import type { VaultFile, VaultPort } from "../types";
import { createFakeServer, errorResponse, jsonResponse } from "./fake-server";

function makeVault(contents: Record<string, string>): VaultPort {
	return {
		listMarkdown: () =>
			Object.entries(contents).map(([path, text]) => ({
				path,
				size: text.length,
				mtime: 1,
			})),
		read: (path) => {
			const value = contents[path];
			return value === undefined
				? Promise.reject(new Error("missing"))
				: Promise.resolve(value);
		},
	};
}

function setup(contents: Record<string, string>, plan = {}) {
	const server = createFakeServer(plan);
	const vault = makeVault(contents);
	const client = new SyncClient({
		baseUrl: "https://dm.convex.site",
		key: "dmk_secret",
		pluginVersion: "0.1.0",
		transport: server.transport,
	});
	return { server, vault, runner: new SyncRunner({ client, vault }) };
}

function filesOf(vault: VaultPort): VaultFile[] {
	return vault.listMarkdown();
}

const SHA_PATTERN = /^[a-f0-9]{64}$/;
const approve = { approveRemovals: true, confirmMass: false };

describe("SyncRunner", () => {
	test("sends the manifest, pushes the plan and finishes cleanly", async () => {
		const { server, vault, runner } = setup({ "a.md": "# A", "b.md": "# B" });
		const prepared = await runner.prepare(filesOf(vault));
		expect(prepared.ok).toBe(true);
		if (!prepared.ok) {
			return;
		}
		const outcome = await runner.execute(prepared.value, approve);
		expect(outcome.pushed).toBe(2);
		expect(outcome.finishError).toBeNull();
		expect(server.state.calls.map((call) => call.route)).toEqual([
			"plan",
			"push",
			"finish",
		]);
		const plan = server.state.calls[0]?.body as {
			manifest: Array<{ sha256: string }>;
		};
		expect(plan.manifest[0]?.sha256).toMatch(SHA_PATTERN);
	});

	test("splits pushes into batches of at most 50 files", async () => {
		const contents: Record<string, string> = {};
		for (let index = 0; index < MAX_PUSH_FILES + 5; index++) {
			contents[`n${index}.md`] = `note ${index}`;
		}
		const { server, vault, runner } = setup(contents);
		const prepared = await runner.prepare(filesOf(vault));
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		const outcome = await runner.execute(prepared.value, approve);
		const pushes = server.state.calls.filter((call) => call.route === "push");
		expect(pushes).toHaveLength(2);
		expect(outcome.pushed).toBe(MAX_PUSH_FILES + 5);
	});

	test("keeps removals pending when not approved and reports it", async () => {
		const { server, vault, runner } = setup(
			{ "a.md": "# A" },
			{ add: [], remove: ["old.md"] },
		);
		const prepared = await runner.prepare(filesOf(vault));
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		const outcome = await runner.execute(prepared.value, {
			approveRemovals: false,
			confirmMass: false,
		});
		expect(outcome.removalSkipped).toBe(true);
		expect(outcome.finishError).toBe("remove_not_confirmed");
		expect(server.state.calls.some((call) => call.route === "remove")).toBe(
			false,
		);
	});

	test("mass removals need the typed confirmation and send confirmMass", async () => {
		const remove = Array.from({ length: 12 }, (_, index) => `old${index}.md`);
		const { server, vault, runner } = setup(
			{},
			{ add: [], remove, massRemove: true },
		);
		const prepared = await runner.prepare([]);
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		const blocked = await runner.execute(prepared.value, {
			approveRemovals: true,
			confirmMass: false,
		});
		expect(blocked.removalSkipped).toBe(true);
		const outcome = await runner.execute(prepared.value, {
			approveRemovals: true,
			confirmMass: true,
		});
		expect(outcome.removed).toBe(12);
		const call = server.state.calls.find((entry) => entry.route === "remove");
		expect((call?.body as { confirmMass: boolean }).confirmMass).toBe(true);
		expect(vault.listMarkdown()).toEqual([]);
	});

	test("chunks removals into groups of 100 paths", async () => {
		const remove = Array.from(
			{ length: MAX_REMOVE_PATHS + 20 },
			(_, index) => `o${index}.md`,
		);
		const { server, runner } = setup({}, { add: [], remove });
		const prepared = await runner.prepare([]);
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		const outcome = await runner.execute(prepared.value, approve);
		expect(
			server.state.calls.filter((call) => call.route === "remove"),
		).toHaveLength(2);
		expect(outcome.removed).toBe(MAX_REMOVE_PATHS + 20);
	});

	test("a failed push stops the run, skips removals and finishes as incomplete", async () => {
		const { server, vault, runner } = setup(
			{ "a.md": "# A" },
			{ remove: ["old.md"] },
		);
		server.state.failRoute = {
			route: "push",
			response: errorResponse("rate_limited", 429, { retryAfterSeconds: 30 }),
		};
		const prepared = await runner.prepare(filesOf(vault));
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		const outcome = await runner.execute(prepared.value, approve);
		expect(outcome.incomplete).toBe(true);
		expect(outcome.fatal?.code).toBe("rate_limited");
		expect(outcome.finishError).toBe("push_incomplete");
		const routes = server.state.calls.map((call) => call.route);
		expect(routes).not.toContain("remove");
		expect(routes.at(-1)).toBe("finish");
	});

	test("a rejected replacement keeps the removal of the old note pending", async () => {
		const { server, vault, runner } = setup(
			{ "new.md": "# New" },
			{ remove: ["old.md"] },
		);
		server.state.pushHandler = (body) =>
			jsonResponse({
				results: body.files.map((file) => ({
					path: file.path,
					status: "rejected",
					code: "allowance_exhausted",
				})),
			});
		const prepared = await runner.prepare(filesOf(vault));
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		const outcome = await runner.execute(prepared.value, approve);
		expect(outcome.removalSkipped).toBe(true);
		expect(outcome.removed).toBe(0);
		expect(server.state.calls.map((call) => call.route)).not.toContain(
			"remove",
		);
	});

	test("retries finish once and flags a run the server never confirmed", async () => {
		const { server, vault, runner } = setup({ "a.md": "# A" });
		server.state.failRoute = {
			route: "finish",
			response: errorResponse("server_error", 500),
		};
		const prepared = await runner.prepare(filesOf(vault));
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		const outcome = await runner.execute(prepared.value, approve);
		expect(outcome.finishFailed).toBe(true);
		expect(
			server.state.calls.filter((call) => call.route === "finish"),
		).toHaveLength(2);
		expect(await runner.cancel(prepared.value)).toBe(false);
	});

	test("treats an expired lease as already released", async () => {
		const { server, vault, runner } = setup({ "a.md": "# A" });
		server.state.failRoute = {
			route: "finish",
			response: errorResponse("run_expired", 410),
		};
		const prepared = await runner.prepare(filesOf(vault));
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		const outcome = await runner.execute(prepared.value, approve);
		expect(outcome.finishFailed).toBe(false);
	});

	test("rejected files are reported and quota rejections flag the finish", async () => {
		const { server, vault, runner } = setup({ "a.md": "# A", "b.md": "# B" });
		server.state.pushHandler = (body) =>
			jsonResponse({
				results: body.files.map((file) =>
					file.path === "a.md"
						? { path: "a.md", status: "accepted" }
						: { path: "b.md", status: "rejected", code: "allowance_exhausted" },
				),
			});
		const prepared = await runner.prepare(filesOf(vault));
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		const outcome = await runner.execute(prepared.value, approve);
		expect(outcome.pushed).toBe(1);
		expect(outcome.rejected).toEqual([
			{ path: "b.md", code: "allowance_exhausted" },
		]);
		expect(outcome.finishError).toBe("quota");
	});

	test("cancel releases the run lease", async () => {
		const { server, vault, runner } = setup({ "a.md": "# A" });
		const prepared = await runner.prepare(filesOf(vault));
		if (!prepared.ok) {
			throw new Error("prepare failed");
		}
		await runner.cancel(prepared.value);
		const last = server.state.calls.at(-1);
		expect(last).toEqual({ route: "finish", body: { runId: "run_1" } });
	});

	test("a plan conflict is surfaced without pushing", async () => {
		const { server, vault, runner } = setup({ "a.md": "# A" });
		server.state.failRoute = {
			route: "plan",
			response: errorResponse("run_conflict", 409),
		};
		const prepared = await runner.prepare(filesOf(vault));
		expect(prepared).toEqual({
			ok: false,
			error: expect.objectContaining({ code: "run_conflict", status: 409 }),
		});
	});

	test("unreadable files stop planning before anything reaches the server", async () => {
		const { server, vault, runner } = setup({ "a.md": "# A" });
		const prepared = await runner.prepare([
			...filesOf(vault),
			{ path: "ghost.md", size: 1, mtime: 1 },
		]);
		expect(prepared).toEqual({
			ok: false,
			error: { code: "unreadable_notes", paths: ["ghost.md"] },
		});
		expect(server.state.calls).toEqual([]);
	});

	test("too many selected files never reach the server", async () => {
		const contents: Record<string, string> = {};
		for (let index = 0; index < MAX_MANIFEST_ENTRIES + 1; index++) {
			contents[`n${index}.md`] = "x";
		}
		const { server, vault, runner } = setup(contents);
		const prepared = await runner.prepare(filesOf(vault));
		expect(prepared).toEqual({ ok: false, error: { code: "too_many_files" } });
		expect(server.state.calls).toEqual([]);
	});
});
