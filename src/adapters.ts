import { type App, requestUrl, type TFile } from "obsidian";
import { SECRET_ID } from "./state";
import type {
	HttpRequest,
	HttpResponse,
	VaultFile,
	VaultPort,
} from "./sync/types";

export function createVaultPort(app: App): VaultPort {
	return {
		listMarkdown: (): VaultFile[] =>
			app.vault
				.getMarkdownFiles()
				.filter(
					(file) => !file.path.split("/").some((part) => part.startsWith(".")),
				)
				.map((file) => ({
					path: file.path,
					size: file.stat.size,
					mtime: file.stat.mtime,
				})),
		read: async (path) => {
			const file = app.vault.getAbstractFileByPath(path);
			if (!(file && "extension" in file)) {
				throw new Error("missing");
			}
			return await app.vault.read(file as TFile);
		},
	};
}

export async function transport(request: HttpRequest): Promise<HttpResponse> {
	const response = await requestUrl({
		url: request.url,
		method: request.method,
		headers: request.headers,
		body: request.body,
		throw: false,
	});
	return { status: response.status, text: response.text };
}

export function readKey(app: App): string | null {
	const value = app.secretStorage.getSecret(SECRET_ID);
	return value && value.length > 0 ? value : null;
}

export function writeKey(app: App, key: string) {
	app.secretStorage.setSecret(SECRET_ID, key);
}
