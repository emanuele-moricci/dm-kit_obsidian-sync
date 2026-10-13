# DM Kit Sync

Send the notes you choose from your Obsidian vault to [DM Kit](https://dm-kit.com), a toolkit for Dungeon Masters, so your campaign tools and the Lorekeeper assistant can use them.

Sync is **one-way** (Obsidian to DM Kit) and **manual**: nothing leaves your vault until you review and confirm.

## Requirements

- Obsidian 1.11.4 or newer, desktop only.
- A free [DM Kit](https://dm-kit.com) account. The plugin does nothing without one.

## Install

Open **Settings → Community plugins**, search for **DM Kit Sync**, install and enable it.

To try a build by hand, copy `main.js`, `manifest.json` and `styles.css` from a [release](https://github.com/emanuele-moricci/dm-kit_obsidian-sync/releases) into `<vault>/.obsidian/plugins/dm-kit-sync/`.

## Connect

1. In DM Kit, open **Notes Memory → Add notes → Sync with an App** and create a connection. Copy the connection string (shown once).
2. In Obsidian, open **Settings → DM Kit Sync**, paste the string and press **Connect**.

## Choose what to sync

The settings page shows your vault as a tree. Check the folders and notes you want in DM Kit. New notes inside a checked folder are included automatically. Unchecking a note removes it from DM Kit after you review the sync.

## Sync

Run **Review & sync** from the command palette or the ribbon icon. The plugin lists what is new, changed, skipped and what would be removed. Removals need your explicit confirmation, and removing many notes at once asks you to type the number. **Show sync status** reports storage use and indexing errors.

## Privacy and network use

- Only the Markdown notes you select are uploaded, over HTTPS, to your DM Kit account.
- The connection key is stored in Obsidian's secret storage, never in your vault or in plugin settings.
- The plugin never reads files outside your vault and never syncs on its own.
- No ads, no analytics and no telemetry in the plugin.
- Disconnect in Obsidian to forget the key. Revoke or delete the connection in DM Kit to cut access.

## Limits

- Markdown notes up to 2 MB each, up to 2000 selected notes per sync.
- Your DM Kit storage allowance applies to synced notes.

## Development

```bash
npm install
npm run dev      # rebuild main.js on change
npm run build    # production build
npm test
npm run typecheck
```

Copy the build output into `<vault>/.obsidian/plugins/dm-kit-sync/` (or symlink the folder) and reload the plugin.

## Support

Questions and bug reports: [open an issue](https://github.com/emanuele-moricci/dm-kit_obsidian-sync/issues) or visit [dm-kit.com](https://dm-kit.com).

## License

[MIT](LICENSE) © DM Kit
