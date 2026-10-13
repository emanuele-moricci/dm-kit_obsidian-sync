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
		this.refreshStatusBar();
		this.registerInterval(
			window.setInterval(() => this.refreshStatusBar(), STATUS_REFRESH_MS),
		);
		this.addRibbonIcon("refresh-cw", STRINGS.ribbonTitle, () => this.review());
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
			openSettings: () => {
				const setting = (
					this.app as unknown as {
						setting: { open: () => void; openTabById: (id: string) => void };
					}
				).setting;
				setting.open();
				setting.openTabById(this.manifest.id);
			},
		};
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
