import { MAX_MANIFEST_ENTRIES } from "../contract/limits";
import type { ManifestEntry } from "../contract/types";
import { byteLength, sha256Hex } from "./hash";
import type { ManifestProgress, VaultFile, VaultPort } from "./types";

const YIELD_EVERY = 25;

export interface BuiltManifestResult {
	entries: ManifestEntry[];
	unreadable: string[];
	overLimit: boolean;
}

function yieldToUi(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function buildManifest(
	vault: VaultPort,
	files: readonly VaultFile[],
	onProgress?: (progress: ManifestProgress) => void,
): Promise<BuiltManifestResult> {
	const entries: ManifestEntry[] = [];
	const unreadable: string[] = [];
	let done = 0;
	for (const file of files) {
		try {
			const content = await vault.read(file.path);
			entries.push({
				path: file.path,
				size: byteLength(content),
				sha256: await sha256Hex(content),
			});
		} catch {
			unreadable.push(file.path);
		}
		done += 1;
		onProgress?.({ done, total: files.length });
		if (done % YIELD_EVERY === 0) {
			await yieldToUi();
		}
	}
	return {
		entries,
		unreadable,
		overLimit: entries.length > MAX_MANIFEST_ENTRIES,
	};
}
