import { type App, Modal } from "obsidian";
import { STRINGS } from "../strings";

export class MassRemoveModal extends Modal {
	private readonly count: number;
	private readonly onDecision: (confirmed: boolean) => void;
	private decided = false;

	constructor(
		app: App,
		count: number,
		onDecision: (confirmed: boolean) => void,
	) {
		super(app);
		this.count = count;
		this.onDecision = onDecision;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: STRINGS.mass.title });
		contentEl.createEl("p", { text: STRINGS.mass.body(this.count) });
		const input = contentEl.createEl("input", {
			type: "text",
			placeholder: STRINGS.mass.placeholder(this.count),
		});
		input.setAttr("inputmode", "numeric");
		input.setAttr("aria-label", STRINGS.mass.body(this.count));
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		const confirm = buttons.createEl("button", {
			text: STRINGS.mass.confirm,
			cls: "mod-warning",
		});
		confirm.disabled = true;
		const cancel = buttons.createEl("button", { text: STRINGS.mass.cancel });
		input.addEventListener("input", () => {
			confirm.disabled = input.value.trim() !== String(this.count);
		});
		confirm.addEventListener("click", () => this.decide(true));
		cancel.addEventListener("click", () => this.decide(false));
		input.focus();
	}

	onClose() {
		this.contentEl.empty();
		this.decide(false);
	}

	private decide(confirmed: boolean) {
		if (this.decided) {
			return;
		}
		this.decided = true;
		this.onDecision(confirmed);
		this.close();
	}
}
