import { describe, expect, it } from "vitest";
import { capacityRatio } from "../capacity";

const quota = { limitBytes: 1000, limitNotes: 100 };

describe("capacityRatio", () => {
	it("follows the tightest limit", () => {
		expect(capacityRatio(quota, { bytes: 100, notes: 50 })).toBe(0.5);
		expect(capacityRatio(quota, { bytes: 800, notes: 10 })).toBe(0.8);
	});

	it("caps at full", () => {
		expect(capacityRatio(quota, { bytes: 5000, notes: 1 })).toBe(1);
	});

	it("treats a zero limit as full", () => {
		expect(
			capacityRatio({ limitBytes: 0, limitNotes: 100 }, { bytes: 0, notes: 0 }),
		).toBe(1);
	});
});
