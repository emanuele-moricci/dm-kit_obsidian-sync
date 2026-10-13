import { describe, expect, test } from "vitest";
import {
	CONNECTION_STRING_PREFIX,
	parseConnectionString,
} from "../connection-string";

function encode(payload: unknown): string {
	const json = JSON.stringify(payload);
	const base64 = Buffer.from(json, "utf-8").toString("base64url");
	return `${CONNECTION_STRING_PREFIX}${base64}`;
}

describe("parseConnectionString", () => {
	test("accepts an https url and trims trailing slashes", () => {
		const result = parseConnectionString(
			encode({ url: "https://app.dm-kit.com/", key: "dmk_abc" }),
		);
		expect(result).toEqual({
			ok: true,
			value: { url: "https://app.dm-kit.com", key: "dmk_abc" },
		});
	});

	test("accepts http only for localhost hosts", () => {
		expect(
			parseConnectionString(
				encode({ url: "http://localhost:5050", key: "dmk_abc" }),
			).ok,
		).toBe(true);
		expect(
			parseConnectionString(
				encode({ url: "http://127.0.0.1:3211", key: "dmk_abc" }),
			).ok,
		).toBe(true);
		expect(
			parseConnectionString(
				encode({ url: "http://app.dm-kit.com", key: "dmk_abc" }),
			),
		).toEqual({ ok: false, code: "insecure_url" });
	});

	test("rejects a missing prefix", () => {
		expect(parseConnectionString("abc")).toEqual({
			ok: false,
			code: "invalid_prefix",
		});
	});

	test("rejects payloads that are not valid base64 json", () => {
		expect(parseConnectionString("dmk1.@@@")).toEqual({
			ok: false,
			code: "invalid_encoding",
		});
		expect(
			parseConnectionString(
				`dmk1.${Buffer.from("not json").toString("base64url")}`,
			),
		).toEqual({ ok: false, code: "invalid_encoding" });
	});

	test("rejects payloads missing the url or the key", () => {
		expect(parseConnectionString(encode({ url: "https://x.com" }))).toEqual({
			ok: false,
			code: "invalid_payload",
		});
		expect(parseConnectionString(encode({ key: "dmk_abc" }))).toEqual({
			ok: false,
			code: "invalid_payload",
		});
		expect(parseConnectionString(encode("string"))).toEqual({
			ok: false,
			code: "invalid_payload",
		});
	});

	test("tolerates surrounding whitespace from copy and paste", () => {
		const result = parseConnectionString(
			`  ${encode({ url: "https://app.dm-kit.com", key: "dmk_abc" })}\n`,
		);
		expect(result.ok).toBe(true);
	});
});
