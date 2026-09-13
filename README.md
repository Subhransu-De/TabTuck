<p align="center">
  <img src="icons/512.png" alt="TabTuck icon" width="128" height="128" />
</p>

# TabTuck

Save tabs for later, keep them organized, and restore them in the same browser window. Built for Helium and other Chromium browsers with vanilla JavaScript and Tailwind CSS.

## Features

- Save the current tab or tabs to its left or right. Pinned tabs and tabs in browser groups are skipped.
- Organize saved links with groups, folders, stars, search, and a view grouped by site.
- Drag links to reorder them or move them between groups.
- Restore individual links or whole groups in the same window.
- Import OneTab text exports and export saved tabs.
- Use light or dark mode.

## Install

1. Install [Bun](https://bun.sh/), then run `bun install --frozen-lockfile` and `bun run build`.
2. Open your browser's extensions page and enable **Developer mode**.
3. Choose **Load unpacked** and select `dist/TabTuck`.

Click the toolbar icon to open TabTuck. Use its context menu to save tabs.

| Shortcut | Action               |
| -------- | -------------------- |
| `Alt+C`  | Save the current tab |
| `Alt+Q`  | Open TabTuck         |

Shortcuts can be changed on the browser's extension shortcuts page.

## Development

```sh
bun install --frozen-lockfile
bun run check
```

`bun run check` runs linting, formatting checks, unit tests, the build, and extension validation. The build creates `dist/TabTuck` and `dist/TabTuck.zip`. CI also runs secret scanning and browser tests.

Saved tabs are stored locally in the browser's extension storage. Export a backup before uninstalling the extension or moving to a different browser profile.
