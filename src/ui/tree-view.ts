import { STRINGS } from "../strings";
import type { TreeNode } from "../sync/types";
import { formatBytes } from "./format";

export interface TreeViewHandlers {
	isExpanded: (path: string) => boolean;
	onToggleExpanded: (path: string) => void;
	onToggleChecked: (node: TreeNode, checked: boolean) => void;
}

function weightText(node: TreeNode): string {
	return `${node.selectedCount}/${node.count} · ${formatBytes(node.selectedBytes)}`;
}

function renderRow(
	parent: HTMLElement,
	node: TreeNode,
	handlers: TreeViewHandlers,
) {
	const row = parent.createDiv({ cls: "dmk-sync-tree-row" });
	const isFolder = node.type === "folder";
	if (isFolder) {
		const expanded = handlers.isExpanded(node.path);
		const toggle = row.createEl("button", {
			cls: "dmk-sync-tree-toggle clickable-icon",
			text: expanded ? "▾" : "▸",
		});
		toggle.setAttr("aria-expanded", String(expanded));
		toggle.setAttr(
			"aria-label",
			`${expanded ? STRINGS.settings.collapse : STRINGS.settings.expand} ${node.name}`,
		);
		toggle.addEventListener("click", () =>
			handlers.onToggleExpanded(node.path),
		);
	} else {
		row.createSpan({ cls: "dmk-sync-tree-toggle" });
	}
	const label = row.createEl("label", { cls: "dmk-sync-tree-label" });
	const checkbox = label.createEl("input", { type: "checkbox" });
	checkbox.checked = node.state === "checked";
	checkbox.indeterminate = node.state === "indeterminate";
	checkbox.addEventListener("change", () =>
		handlers.onToggleChecked(node, checkbox.checked),
	);
	label.createSpan({ text: node.name || STRINGS.settings.vaultTotal });
	row.createSpan({
		cls: "dmk-sync-tree-weight dmk-sync-muted",
		text: isFolder ? weightText(node) : formatBytes(node.bytes),
	});
}

function renderChildren(
	parent: HTMLElement,
	node: TreeNode,
	handlers: TreeViewHandlers,
) {
	const list = parent.createEl("ul", { cls: "dmk-sync-tree-list" });
	for (const child of node.children) {
		const item = list.createEl("li");
		renderRow(item, child, handlers);
		if (child.type === "folder" && handlers.isExpanded(child.path)) {
			renderChildren(item, child, handlers);
		}
	}
}

export function renderTree(
	parent: HTMLElement,
	root: TreeNode,
	handlers: TreeViewHandlers,
) {
	const container = parent.createDiv({ cls: "dmk-sync-tree" });
	if (root.count === 0) {
		container.createEl("p", {
			text: STRINGS.settings.noNotes,
			cls: "dmk-sync-muted",
		});
		return;
	}
	renderRow(container, root, handlers);
	renderChildren(container, root, handlers);
}
