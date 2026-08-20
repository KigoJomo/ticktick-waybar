# TickTick Waybar

TickTick controls for Waybar and Walker. The bar shows overdue and due-today tasks, while Walker handles quick capture, detailed task entry, and completion.

![TickTick as a separate Waybar pill](docs/screenshots/waybar.png)

![Searchable task completion in Walker](docs/screenshots/walker.png)

![Detailed task entry in Walker](docs/screenshots/detailed.png)

## Install

You need Waybar, Walker, Node.js 20 or newer, and npm.

```bash
git clone https://github.com/KigoJomo/ticktick-waybar.git ~/.local/share/ticktick-waybar
~/.local/share/ticktick-waybar/install.sh
```

The installer opens TickTick's OAuth flow, installs the TickTick glyph, backs up the active Waybar files, adds the module, and reloads Waybar. It also restricts the TickTick CLI credential files to your user account.

## Use

| Waybar action | What it does |
| --- | --- |
| Hover | Shows overdue and today's tasks |
| Left-click | Opens completion and task creation |
| Right-click | Adds a task to Inbox |
| Middle-click | Opens TickTick Today |

The same actions are available in a terminal.

```bash
tickbar menu
tickbar add
tickbar add --details
tickbar auth
tickbar refresh
```

Detailed entry supports a description, due date, local time, priority, list, tags, and comma-separated subtasks. Dates accept `today`, `tomorrow`, `YYYY-MM-DD`, or `YYYY-MM-DD HH:MM`.

The Walker menu opens from a local snapshot, so TickTick API latency does not hold up the menu. A failed refresh leaves the previous result visible and marks it stale. Notes do not appear in the completion list.

## Configure

The installer can target non-default Waybar files and either the left, centre, or right module group.

```bash
./install.sh \
  --waybar-config ~/.config/waybar/config.jsonc \
  --waybar-style ~/.config/waybar/style.css \
  --position center
```

Runtime settings live in `~/.config/ticktick-waybar/config.json`.

```json
{
  "cacheMinutes": 5,
  "defaultProjectId": null,
  "tooltipLimit": 8,
  "timeZone": "Africa/Nairobi",
  "todayUrl": "https://ticktick.com/webapp/#q/all/today"
}
```

TickTick's API does not return Inbox in the project list. TickTick Waybar normally learns the Inbox ID from existing tasks. For a completely empty account, set `defaultProjectId` to the list ID returned by `ticktick project list --json`.

Update an existing install with `git pull && ./install.sh --no-auth`.

## Uninstall

```bash
./uninstall.sh
```

Pass `--purge` to sign out and remove the cache, state, and runtime configuration. Waybar backups remain in `~/.config/waybar/.ticktick-waybar-backups/`.

## Development

```bash
npm ci
npm run verify
```

The TickTick adapter uses the official `@ticktick/ticktick-cli` package. The glyph comes from [`simple-icons-font`](https://github.com/simple-icons/simple-icons-font). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the bundled licence notices.

MIT licensed.
