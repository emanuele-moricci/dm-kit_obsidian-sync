import { describe, expect, test } from "vitest";
import { SyncClient } from "../client";
import type { HttpRequest, Transport } from "../types";
import { errorResponse, jsonResponse } from "./fake-server";

function makeClient(transport: Transport) {
	return new SyncClient({
		baseUrl: "https://dm.convex.site",
		key: "dmk_secret",
		pluginVersion: "0.1.0",
		transport,
	});
}

describe("SyncClient", () => {
	test("sends auth, version and JSON headers to the versioned route", async () => {
		let seen: HttpRequest | undefined;
		const client = makeClient((request) => {
			seen = request;
			return Promise.resolve(jsonResponse({ ok: true }));
		});
		await client.finish({ runId: "r" });
		expect(seen?.url).toBe("https://dm.convex.site/sync/v1/finish");
		expect(seen?.headers.Authorization).toBe("Bearer dmk_secret");
		expect(seen?.headers["X-DMK-Plugin-Version"]).toBe("0.1.0");
		expect(seen?.headers["Content-Type"]).toBe("application/json");
	});

	test("GET status has no body or content type", async () => {
		let seen: HttpRequest | undefined;
		const client = makeClient((request) => {
			seen = request;
			return Promise.resolve(jsonResponse({}));
		});
		await client.status();
		expect(seen?.method).toBe("GET");
		expect(seen?.body).toBeUndefined();
		expect(seen?.headers["Content-Type"]).toBeUndefined();
	});

	test("maps the error envelope", async () => {
		const client = makeClient(async () =>
			errorResponse("upgrade_required", 426, {
				details: { minVersion: "0.2.0" },
			}),
		);
		const result = await client.status();
		expect(result).toEqual({
			ok: false,
			error: expect.objectContaining({
				code: "upgrade_required",
				status: 426,
				details: { minVersion: "0.2.0" },
			}),
		});
	});

	test("transport failures become network errors", async () => {
		const client = makeClient(() => Promise.reject(new Error("offline")));
		expect(await client.status()).toEqual({
			ok: false,
			error: { code: "network", status: 0 },
		});
	});

	test("unknown error bodies degrade by status", async () => {
		const html = makeClient(() =>
			Promise.resolve({ status: 502, text: "<html>" }),
		);
		expect(await html.status()).toEqual({
			ok: false,
			error: { code: "server_error", status: 502 },
		});
		const odd = makeClient(() =>
			Promise.resolve({ status: 404, text: "nope" }),
		);
		expect(await odd.status()).toEqual({
			ok: false,
			error: { code: "invalid_response", status: 404 },
		});
	});

	test("non JSON success bodies are invalid responses", async () => {
		const client = makeClient(() =>
			Promise.resolve({ status: 200, text: "oops" }),
		);
		expect(await client.status()).toEqual({
			ok: false,
			error: { code: "invalid_response", status: 200 },
		});
	});
});
