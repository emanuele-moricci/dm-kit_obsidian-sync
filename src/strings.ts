export const STRINGS = {
	pluginName: "DM Kit Sync",
	commandReview: "Review & sync",
	commandStatus: "Show sync status",
	ribbonTitle: "DM Kit: review & sync",

	settings: {
		heading: "DM Kit Sync",
		connectionName: "Connection",
		connectionDesc:
			"Create a connection string in DM Kit, under Notes → Connections, and paste it here.",
		connectionPlaceholder: "dmk1.…",
		connect: "Connect",
		connected: "Connected to",
		disconnect: "Disconnect",
		disconnectDesc:
			"Removes the connection string from this vault. Your notes in DM Kit stay until you disconnect there.",
		selectionHeading: "What to sync",
		selectionDesc:
			"Only checked notes are sent to DM Kit. Notes you uncheck later are removed from DM Kit after you review the sync.",
		vaultTotal: "Vault",
		selected: "selected",
		notConnected: "Not connected",
		openDmKit: "Open DM Kit",
		noNotes: "No Markdown notes found in this vault.",
		expand: "Expand",
		collapse: "Collapse",
	},

	connection: {
		invalid_prefix: "This isn't a DM Kit connection string.",
		invalid_encoding: "This connection string is damaged. Copy it again.",
		invalid_payload: "This connection string is damaged. Copy it again.",
		insecure_url:
			"This connection string points to an insecure address, so it was refused.",
	},

	preview: {
		title: "Review sync",
		preparing: "Reading your vault…",
		contacting: "Asking DM Kit what changed…",
		campaign: (name: string | null) =>
			name ? `Syncing to campaign: ${name}` : "Syncing to your DM Kit notes",
		add: "New",
		update: "Changed",
		retry: "Retry",
		unchanged: "Unchanged",
		skipped: "Won't sync",
		remove: "Remove from DM Kit",
		removeBand: (count: number) =>
			count === 1
				? "1 note will be removed from DM Kit"
				: `${count} notes will be removed from DM Kit`,
		removeExplain:
			"These notes are no longer selected or were deleted from your vault.",
		removeApprove: "I understand these notes will be removed from DM Kit",
		nothing: "Everything is already up to date.",
		sync: "Sync now",
		syncNothing: "Close",
		cancel: "Cancel",
	},

	capacity: {
		line: (
			bytes: { used: string; limit: string },
			notes: { used: number; limit: number },
			plan: string,
		) =>
			`${bytes.used} of ${bytes.limit} · ${notes.used} of ${notes.limit} notes · ${plan}`,
		plan: { free: "Free plan", pro: "Pro plan" },
	},

	skipReason: {
		not_markdown: "Not a Markdown note",
		empty: "Empty note",
		too_large: "Larger than 2 MB",
		quota: "Over your DM Kit plan limits",
		path_invalid: "Unsupported file path",
		indexing: "Still being indexed in DM Kit",
	},

	mass: {
		title: "Remove many notes?",
		body: (count: number) =>
			`This sync will remove ${count} notes from DM Kit. Type ${count} to confirm.`,
		placeholder: (count: number) => String(count),
		confirm: "Remove notes",
		cancel: "Cancel",
	},

	progress: {
		start: "Getting ready to send your notes to DM Kit, please hold…",
		push: (done: number, total: number) =>
			`Pushing your notes to DM Kit, please hold… ${done} of ${total} sent.`,
		remove: (done: number, total: number) =>
			`Removing notes you unselected from DM Kit… ${done} of ${total} done.`,
		finish:
			"Confirming everything arrived in DM Kit, almost done. Please keep Obsidian open…",
	},

	result: {
		title: "Sync finished",
		titleIncomplete: "Sync stopped early",
		added: (count: number) => `${count} new`,
		updated: (count: number) => `${count} updated`,
		retried: (count: number) => `${count} retried`,
		removed: (count: number) => `${count} removed`,
		unchanged: (count: number) => `${count} unchanged`,
		skipped: (count: number) => `${count} skipped`,
		rejected: (count: number) => `${count} couldn't be uploaded`,
		removalKept: "Removals were kept pending. Review them next sync.",
		finishFailed:
			"DM Kit didn't confirm that this sync was closed. If the next sync says one is still running, wait a few minutes and try again.",
		indexingNote:
			"DM Kit is indexing your notes. They become searchable over the next few minutes.",
		close: "Close",
		retry: "Try again",
		openSettings: "Open settings",
		openDmKit: "Open DM Kit",
	},

	rejection: {
		hash_mismatch: "The note changed while syncing",
		path_invalid: "Unsupported file path",
		invalid_content: "The note couldn't be read or is empty",
		allowance_exhausted: "Over your DM Kit plan limits",
		in_progress: "Still being indexed in DM Kit",
		too_large: "Larger than 2 MB",
	},

	status: {
		title: "Sync status",
		loading: "Loading…",
		neverSynced: "Never synced",
		lastSync: (when: string) => `Last sync ${when}`,
		notes: (total: number) => `${total} notes in DM Kit`,
		processing: (count: number) => `${count} being indexed`,
		failed: (count: number) => `${count} failed to index`,
		failedList: "Notes that failed to index",
		lastError: "Last sync problem",
		refresh: "Refresh",
		bar: {
			idle: "DM Kit: not synced",
			synced: (when: string) => `DM Kit: synced ${when}`,
			running: "DM Kit: syncing…",
			error: "DM Kit: sync problem",
			disconnected: "DM Kit: not connected",
		},
	},

	lastError: {
		push_incomplete: "The last sync stopped before all notes were uploaded.",
		remove_not_confirmed: "Removals from the last sync are waiting for you.",
		quota: "Some notes didn't fit in your DM Kit plan limits.",
	},

	notices: {
		notConnected: "DM Kit Sync: connect a vault first in the plugin settings.",
		connected: "DM Kit Sync: connected.",
		disconnected: "DM Kit Sync: disconnected.",
		nothingSelected:
			"DM Kit Sync: nothing is selected yet. Pick notes in the plugin settings.",
		busy: "DM Kit Sync: a sync is already running.",
		releaseFailed:
			"DM Kit Sync: couldn't close the sync on DM Kit. It will be released automatically in a few minutes.",
	},

	errors: {
		unauthorized:
			"DM Kit didn't accept this connection. It may have been disconnected or replaced. Paste a new connection string in settings.",
		forbidden:
			"This connection isn't allowed to sync. Create a new connection string in DM Kit.",
		campaign_archived:
			"This campaign is archived in DM Kit, so syncing is paused. Unarchive it in DM Kit or connect another campaign.",
		run_conflict:
			"Another sync is running for this connection, maybe from another device. Try again in a few minutes.",
		run_expired: "The sync took too long and expired. Run it again.",
		rate_limited: (seconds?: number) =>
			seconds
				? `Too many requests. Try again in ${seconds} seconds.`
				: "Too many requests. Try again in a minute.",
		payload_too_large:
			"A batch was too large for DM Kit. Update the plugin or uncheck your largest notes.",
		upgrade_required: (minVersion?: string) =>
			minVersion
				? `Update the DM Kit Sync plugin to ${minVersion} or newer.`
				: "Update the DM Kit Sync plugin to keep syncing.",
		invalid_request:
			"DM Kit couldn't read this sync request. Update the plugin and try again.",
		server_error: "DM Kit had a problem. Try again in a few minutes.",
		invalid_response: "DM Kit sent an unexpected answer. Try again later.",
		network: "Couldn't reach DM Kit. Check your connection and try again.",
		unreadable_notes: (paths: string[]) =>
			`Couldn't read ${paths.length} selected ${paths.length === 1 ? "note" : "notes"} (${paths.slice(0, 3).join(", ")}${paths.length > 3 ? ", …" : ""}). The sync was stopped so nothing is removed from DM Kit by mistake. Try again in a moment.`,
		too_many_files:
			"You selected too many notes for one sync. Uncheck some folders and try again.",
		confirm_mass_required:
			"DM Kit needs you to confirm removing many notes. Run the sync again.",
	},
} as const;
