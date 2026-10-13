import { isSelected } from "./selection";
import type { CheckState, SelectionRules, TreeNode, VaultFile } from "./types";

function makeFolder(name: string, path: string): TreeNode {
	return {
		type: "folder",
		name,
		path,
		bytes: 0,
		count: 0,
		selectedBytes: 0,
		selectedCount: 0,
		state: "unchecked",
		children: [],
	};
}

function stateFor(selectedCount: number, count: number): CheckState {
	if (selectedCount === 0) {
		return "unchecked";
	}
	return selectedCount === count ? "checked" : "indeterminate";
}

function finalize(node: TreeNode) {
	node.children.sort((left, right) => {
		if (left.type !== right.type) {
			return left.type === "folder" ? -1 : 1;
		}
		return left.name.localeCompare(right.name, undefined, {
			numeric: true,
			sensitivity: "base",
		});
	});
	for (const child of node.children) {
		if (child.type === "folder") {
			finalize(child);
		}
	}
	node.state = stateFor(node.selectedCount, node.count);
}

function ensureFolders(
	root: TreeNode,
	folders: Map<string, TreeNode>,
	segments: string[],
): TreeNode[] {
	const chain: TreeNode[] = [root];
	let parent = root;
	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		let folder = folders.get(current);
		if (!folder) {
			folder = makeFolder(segment, current);
			folders.set(current, folder);
			parent.children.push(folder);
		}
		parent = folder;
		chain.push(folder);
	}
	return chain;
}

function addFile(chain: TreeNode[], file: VaultFile, selected: boolean) {
	const name = file.path.split("/").pop() as string;
	const parent = chain.at(-1) as TreeNode;
	parent.children.push({
		type: "file",
		name,
		path: file.path,
		bytes: file.size,
		count: 1,
		selectedBytes: selected ? file.size : 0,
		selectedCount: selected ? 1 : 0,
		state: selected ? "checked" : "unchecked",
		children: [],
	});
	for (const folder of chain) {
		folder.bytes += file.size;
		folder.count += 1;
		folder.selectedBytes += selected ? file.size : 0;
		folder.selectedCount += selected ? 1 : 0;
	}
}

export function buildTree(
	files: readonly VaultFile[],
	rules: SelectionRules,
): TreeNode {
	const root = makeFolder("", "");
	const folders = new Map<string, TreeNode>([["", root]]);
	for (const file of files) {
		const segments = file.path.split("/");
		segments.pop();
		addFile(
			ensureFolders(root, folders, segments),
			file,
			isSelected(rules, file.path),
		);
	}
	finalize(root);
	return root;
}

export function selectedFiles(
	files: readonly VaultFile[],
	rules: SelectionRules,
): VaultFile[] {
	return files.filter((file) => isSelected(rules, file.path));
}
