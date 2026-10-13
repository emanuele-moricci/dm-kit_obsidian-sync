import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import { writeKey } from "../adapters";
import { describeError } from "../errors";
import type { FlowHost } from "../flow";
import { connectionFromString, createClient } from "../flow";
import type { PluginData } from "../state";
import { STRINGS } from "../strings";
import { setFileSelected, setFolderSelected } from "../sync/selection";
import { buildTree } from "../sync/tree";
import type { TreeNode, VaultPort } from "../sync/types";
import { formatBytes } from "./format";
import { renderTree } from "./tree-view";

export interface SettingsHost extends FlowHost {
	vault: VaultPort;
	persist: () => Promise<void>;
	refreshStatusBar: () => void;
}

interface TabPlugin {
	app: App;
}

export class DmKitSettingTab extends PluginSettingTab {
	private readonly host: SettingsHost;

	constructor(
		plugin: TabPlugin & ConstructorParameters<typeof PluginSettingTab>[1],
		host: SettingsHost,
	) {
		super(plugin.app, plugin);
		this.host = host;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl).setName(STRINGS.settings.heading).setHeading();
		this.renderConnection(containerEl);
		this.renderSelection(containerEl);
	}

	private get data(): PluginData {
		return this.host.data;
	}

	private renderConnection(parent: HTMLElement) {
		if (this.data.connection) {
			this.renderConnected(parent, this.data.connection.name);
			return;
		}
		let pasted = "";
		new Setting(parent)
			.setName(STRINGS.settings.connectionName)
			.setDesc(STRINGS.settings.connectionDesc)
			.addText((text) => {
				text.inputEl.type = "password";
				text.inputEl.autocomplete = "off";
				text.setPlaceholder(STRINGS.settings.connectionPlaceholder);
				text.onChange((value) => {
					pasted = value;
				});
			})
			.addButton((button) =>
				button
					.setButtonText(STRINGS.settings.connect)
					.setCta()
					.onClick(() => this.connect(pasted)),
			);
	}

	private renderConnected(parent: HTMLElement, name: string | undefined) {
		new Setting(parent)
			.setName(`${STRINGS.settings.connected} ${name ?? STRINGS.pluginName}`)
			.setDesc(STRINGS.settings.disconnectDesc)
			.addButton((button) =>
				button
					.setButtonText(STRINGS.settings.disconnect)
					.setWarning()
					.onClick(() => this.disconnect()),
			);
	}

	private async connect(raw: string) {
		const parsed = connectionFromString(raw);
		if (!parsed.ok) {
			new Notice(STRINGS.connection[parsed.code]);
			return;
		}
		writeKey(this.app, parsed.value.key);
		this.data.connection = { url: parsed.value.url };
		const client = createClient(this.host);
		const status = client ? await client.status() : null;
		if (!status?.ok) {
			this.data.connection = null;
			writeKey(this.app, "");
			new Notice(
				status
					? describeError(status.error).message
					: STRINGS.errors.unauthorized,
			);
			return;
		}
		this.data.connection = {
			url: parsed.value.url,
			name: status.value.connection.name,
		};
		await this.host.persist();
		this.host.refreshStatusBar();
		new Notice(STRINGS.notices.connected);
		this.display();
	}

	private async disconnect() {
		writeKey(this.app, "");
		this.data.connection = null;
		this.data.lastSync = null;
		await this.host.persist();
		this.host.refreshStatusBar();
		new Notice(STRINGS.notices.disconnected);
		this.display();
	}

	private renderSelection(parent: HTMLElement) {
		new Setting(parent)
			.setName(STRINGS.settings.selectionHeading)
			.setDesc(STRINGS.settings.selectionDesc)
			.setHeading();
		const files = this.host.vault.listMarkdown();
		const root = buildTree(files, this.data.selection);
		parent.createEl("p", {
			cls: "dmk-sync-muted",
			text: `${STRINGS.settings.vaultTotal}: ${root.count} · ${formatBytes(root.bytes)} — ${root.selectedCount} ${STRINGS.settings.selected}`,
		});
		const holder = parent.createDiv();
		this.renderTreeInto(holder, root);
	}

	private renderTreeInto(holder: HTMLElement, root: TreeNode) {
		holder.empty();
		renderTree(holder, root, {
			isExpanded: (path) => path === "" || this.data.expanded.includes(path),
			onToggleExpanded: (path) => {
				const expanded = new Set(this.data.expanded);
				if (expanded.has(path)) {
					expanded.delete(path);
				} else {
					expanded.add(path);
				}
				this.data.expanded = [...expanded];
				this.host.persist();
				this.renderTreeInto(holder, root);
			},
			onToggleChecked: (node, checked) => {
				this.data.selection =
					node.type === "folder"
						? setFolderSelected(this.data.selection, node.path, checked)
						: setFileSelected(this.data.selection, node.path, checked);
				this.host.persist();
				this.display();
			},
		});
	}
}
