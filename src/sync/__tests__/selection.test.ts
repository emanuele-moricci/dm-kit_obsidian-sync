import { describe, expect, test } from "vitest";
import {
	emptySelection,
	isSelected,
	parentFolders,
	pruneSelection,
	setFileSelected,
	setFolderSelected,
} from "../selection";
import { buildTree } from "../tree";
import type { VaultFile } from "../types";

const files: VaultFile[] = [
	{ path: "Campaign/NPCs/Strahd.md", size: 100, mtime: 1 },
	{ path: "Campaign/NPCs/Ireena.md", size: 50, mtime: 1 },
	{ path: "Campaign/Places/Barovia.md", size: 10, mtime: 1 },
	{ path: "Inbox.md", size: 5, mtime: 1 },
];

describe("selection rules", () => {
	test("nothing is selected by default", () => {
		expect(isSelected(emptySelection(), "Inbox.md")).toBe(false);
	});

	test("lists ancestors from the vault root down", () => {
		expect(parentFolders("a/b/c.md")).toEqual(["", "a", "a/b"]);
		expect(parentFolders("c.md")).toEqual([""]);
	});

	test("a folder selection covers new files below it", () => {
		const rules = setFolderSelected(emptySelection(), "Campaign", true);
		expect(isSelected(rules, "Campaign/NPCs/New.md")).toBe(true);
		expect(isSelected(rules, "Inbox.md")).toBe(false);
	});

	test("file overrides beat folder rules and are dropped when redundant", () => {
		let rules = setFolderSelected(emptySelection(), "Campaign", true);
		rules = setFileSelected(rules, "Campaign/NPCs/Strahd.md", false);
		expect(isSelected(rules, "Campaign/NPCs/Strahd.md")).toBe(false);
		expect(isSelected(rules, "Campaign/NPCs/Ireena.md")).toBe(true);
		rules = setFileSelected(rules, "Campaign/NPCs/Strahd.md", true);
		expect(rules.files).toEqual({});
	});

	test("toggling a folder clears descendant rules", () => {
		let rules = setFolderSelected(emptySelection(), "Campaign/NPCs", true);
		rules = setFileSelected(rules, "Campaign/NPCs/Strahd.md", false);
		rules = setFolderSelected(rules, "Campaign", false);
		expect(rules.files).toEqual({});
		expect(rules.folders).toEqual({ Campaign: false });
	});

	test("selecting the vault root clears every other rule", () => {
		let rules = setFolderSelected(emptySelection(), "Campaign", false);
		rules = setFileSelected(rules, "Inbox.md", true);
		rules = setFolderSelected(rules, "", true);
		expect(rules).toEqual({ folders: { "": true }, files: {} });
	});

	test("pruning drops rules for paths that no longer exist", () => {
		const rules = {
			folders: { Campaign: true, Gone: true },
			files: { "Gone/a.md": true, "Inbox.md": true },
		};
		expect(
			pruneSelection(
				rules,
				files.map((file) => file.path),
			),
		).toEqual({
			folders: { Campaign: true },
			files: { "Inbox.md": true },
		});
	});
});

describe("tree", () => {
	test("weights and check states roll up", () => {
		let rules = setFolderSelected(emptySelection(), "Campaign", true);
		rules = setFileSelected(rules, "Campaign/NPCs/Strahd.md", false);
		const root = buildTree(files, rules);
		expect(root.count).toBe(4);
		expect(root.bytes).toBe(165);
		expect(root.selectedBytes).toBe(60);
		expect(root.state).toBe("indeterminate");
		const campaign = root.children.find((node) => node.path === "Campaign");
		expect(campaign?.state).toBe("indeterminate");
		const places = campaign?.children.find(
			(node) => node.path === "Campaign/Places",
		);
		expect(places?.state).toBe("checked");
	});

	test("folders sort before files", () => {
		const root = buildTree(files, emptySelection());
		expect(root.children.map((node) => node.name)).toEqual([
			"Campaign",
			"Inbox.md",
		]);
	});
});
