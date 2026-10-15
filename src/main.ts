import { Notice, Plugin } from "obsidian";
import { createVaultPort } from "./adapters";
import { createClient, startReview } from "./flow";
import {
	defaultData,
	type LastSync,
	normalizeData,
	type PluginData,
} from "./state";
import { STRINGS } from "./strings";
import { DmKitSettingTab } from "./ui/settings-tab";
import { type StatusBarMode, statusBarText } from "./ui/status-bar";
import { StatusModal } from "./ui/status-modal";

const STATUS_REFRESH_MS = 60_000;

export default class DmKitSyncPlugin extends Plugin {
	data: PluginData = defaultData();
	private busy = false;
	private statusBar: HTMLElement | null = null;

	async onload() {
		this.data = normalizeData(await this.loadData());
		this.statusBar = this.addStatusBarItem();
		this.statusBar.addClass("mod-clickable");
		this.statusBar.setAttr("role", "button");
		this.statusBar.setAttr("tabindex", "0");
		this.statusBar.setAttr("aria-label", STRINGS.status.bar.openSettings);
		this.registerDomEvent(this.statusBar, "click", () => this.openSettings());
		this.registerDomEvent(this.statusBar, "keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				this.openSettings();
			}
		});
		this.refreshStatusBar();
		this.registerInterval(
			window.setInterval(() => this.refreshStatusBar(), STATUS_REFRESH_MS),
		);
		this.addRibbonIcon("cloud-upload", STRINGS.ribbonTitle, () =>
			this.review(),
		);
		this.addCommand({
			id: "review-and-sync",
			name: STRINGS.commandReview,
			callback: () => this.review(),
		});
		this.addCommand({
			id: "show-sync-status",
			name: STRINGS.commandStatus,
			callback: () => this.showStatus(),
		});
		this.addSettingTab(
			new DmKitSettingTab(this, {
				...this.host(),
				vault: createVaultPort(this.app),
				persist: () => this.persist(),
				refreshStatusBar: () => this.refreshStatusBar(),
				startSync: () => {
					this.settingsApi().close();
					this.review();
				},
			}),
		);
	}

	private host() {
		const getData = () => this.data;
		return {
			app: this.app,
			version: this.manifest.version,
			get data() {
				return getData();
			},
			setLastSync: async (lastSync: LastSync) => {
				this.data.lastSync = lastSync;
				await this.persist();
				this.refreshStatusBar();
			},
			isBusy: () => this.busy,
			setBusy: (busy: boolean) => {
				this.busy = busy;
				this.refreshStatusBar();
			},
			openSettings: () => this.openSettings(),
		};
	}

	private openSettings() {
		const setting = this.settingsApi();
		setting.open();
		setting.openTabById(this.manifest.id);
	}

	private settingsApi() {
		return (
			this.app as unknown as {
				setting: {
					open: () => void;
					close: () => void;
					openTabById: (id: string) => void;
				};
			}
		).setting;
	}

	private review() {
		startReview(this.host());
	}

	private showStatus() {
		const client = createClient(this.host());
		if (!client) {
			new Notice(STRINGS.notices.notConnected);
			return;
		}
		new StatusModal(this.app, () => client.status()).open();
	}

	private async persist() {
		await this.saveData(this.data);
	}

	private refreshStatusBar() {
		if (!this.statusBar) {
			return;
		}
		let mode: StatusBarMode = "disconnected";
		if (this.busy) {
			mode = "running";
		} else if (this.data.connection) {
			mode = "idle";
		}
		this.statusBar.setText(statusBarText(mode, this.data.lastSync, Date.now()));
	}
}
