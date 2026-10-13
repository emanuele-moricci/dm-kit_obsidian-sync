import type { SelectionRules } from "./types";

export function emptySelection(): SelectionRules {
	return { folders: {}, files: {} };
}

export function parentFolders(path: string): string[] {
	const segments = path.split("/");
	segments.pop();
	const folders: string[] = [];
	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		folders.push(current);
	}
	return ["", ...folders];
}

export function isSelected(rules: SelectionRules, path: string): boolean {
	const override = rules.files[path];
	if (override !== undefined) {
		return override;
	}
	const ancestors = parentFolders(path);
	for (let index = ancestors.length - 1; index >= 0; index--) {
		const rule = rules.folders[ancestors[index] as string];
		if (rule !== undefined) {
			return rule;
		}
	}
	return false;
}

function isInside(folder: string, path: string): boolean {
	return folder === "" || path.startsWith(`${folder}/`);
}

function clearInside(rules: SelectionRules, folder: string) {
	const folders: Record<string, boolean> = {};
	for (const [key, value] of Object.entries(rules.folders)) {
		if (key !== folder && !isInside(folder, key)) {
			folders[key] = value;
		}
	}
	const files: Record<string, boolean> = {};
	for (const [key, value] of Object.entries(rules.files)) {
		if (!isInside(folder, key)) {
			files[key] = value;
		}
	}
	return { folders, files };
}

export function setFolderSelected(
	rules: SelectionRules,
	folder: string,
	selected: boolean,
): SelectionRules {
	const cleared = clearInside(rules, folder);
	return {
		folders: { ...cleared.folders, [folder]: selected },
		files: cleared.files,
	};
}

export function setFileSelected(
	rules: SelectionRules,
	path: string,
	selected: boolean,
): SelectionRules {
	const inherited = isSelected({ folders: rules.folders, files: {} }, path);
	const files = { ...rules.files };
	if (inherited === selected) {
		delete files[path];
	} else {
		files[path] = selected;
	}
	return { folders: rules.folders, files };
}

export function pruneSelection(
	rules: SelectionRules,
	existingPaths: readonly string[],
): SelectionRules {
	const folderSet = new Set<string>([""]);
	const fileSet = new Set(existingPaths);
	for (const path of existingPaths) {
		for (const folder of parentFolders(path)) {
			folderSet.add(folder);
		}
	}
	return {
		folders: Object.fromEntries(
			Object.entries(rules.folders).filter(([key]) => folderSet.has(key)),
		),
		files: Object.fromEntries(
			Object.entries(rules.files).filter(([key]) => fileSet.has(key)),
		),
	};
}
