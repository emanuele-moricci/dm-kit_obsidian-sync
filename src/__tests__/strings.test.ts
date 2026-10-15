import { describe, expect, test } from "vitest";
import { STRINGS } from "../strings";

describe("settings summary", () => {
	test("shows only totals when nothing is selected", () => {
		expect(
			STRINGS.settings.summary(
				{ notes: 180, bytes: "1.9 MB" },
				{ notes: 0, bytes: "0 B" },
			),
		).toBe("Total notes: 180 • Total weight: 1.9 MB");
	});

	test("adds the selected counts in parentheses", () => {
		expect(
			STRINGS.settings.summary(
				{ notes: 180, bytes: "1.9 MB" },
				{ notes: 17, bytes: "0.2 MB" },
			),
		).toBe(
			"Total notes: 180 (17 selected) • Total weight: 1.9 MB (0.2 MB selected)",
		);
	});
});
