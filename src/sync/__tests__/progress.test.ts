import { describe, expect, test } from "vitest";
import { PUSH_BATCH_FILES } from "../../contract/limits";
import {
	creep,
	executeProgress,
	prepareProgress,
	startProgress,
} from "../progress";

describe("progress", () => {
	test("reading the vault fills most of the preparing bar", () => {
		expect(prepareProgress({ done: 0, total: 100 }).fraction).toBe(0);
		expect(prepareProgress({ done: 50, total: 100 }).fraction).toBeCloseTo(
			0.35,
		);
	});

	test("asking the server keeps the bar moving past the read share", () => {
		const progress = prepareProgress({ done: 100, total: 100 });
		expect(progress.fraction).toBeCloseTo(0.7);
		expect(progress.ceiling).toBeGreaterThan(progress.fraction);
	});

	test("pushing grows with the sent notes and may creep toward the next batch", () => {
		const half = executeProgress({ phase: "push", done: 50, total: 100 });
		expect(half.fraction).toBeCloseTo(0.425);
		expect(half.ceiling).toBeCloseTo(0.85 * ((50 + PUSH_BATCH_FILES) / 100));
		const last = executeProgress({ phase: "push", done: 100, total: 100 });
		expect(last.ceiling).toBeCloseTo(0.85);
	});

	test("removals only run after pushing and never go backwards", () => {
		const push = executeProgress({ phase: "push", done: 10, total: 10 });
		const remove = executeProgress({ phase: "remove", done: 0, total: 5 });
		const finish = executeProgress({ phase: "finish", done: 0, total: 1 });
		expect(remove.fraction).toBeGreaterThanOrEqual(push.fraction);
		expect(finish.fraction).toBeGreaterThan(remove.fraction);
		expect(finish.ceiling).toBeLessThan(1);
	});

	test("a removal-only run starts from a full push share", () => {
		expect(
			executeProgress({ phase: "push", done: 0, total: 0 }).fraction,
		).toBeCloseTo(0.85);
	});

	test("waiting for the server holds the bar still", () => {
		const waiting = executeProgress({
			phase: "wait",
			done: 20,
			total: 100,
			waitSeconds: 5,
		});
		expect(waiting.ceiling).toBe(waiting.fraction);
	});

	test("creep moves toward the ceiling without passing it and never goes back", () => {
		const progress = { fraction: 0.2, ceiling: 0.4 };
		let shown = 0;
		for (let step = 0; step < 100; step++) {
			const next = creep(shown, progress);
			expect(next).toBeGreaterThanOrEqual(shown);
			expect(next).toBeLessThanOrEqual(progress.ceiling);
			shown = next;
		}
		expect(shown).toBeGreaterThan(0.39);
		expect(creep(0.9, progress)).toBe(0.9);
		expect(startProgress().fraction).toBe(0);
	});
});
