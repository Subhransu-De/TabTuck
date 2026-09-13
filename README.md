<p align="center">
  <img src="src/icons/512.png" alt="TabTuck icon" width="128" height="128" />
</p>

# TabTuck

Save tabs for later, keep them organized, and restore them in the same browser window. Built for Helium and other Chromium browsers with TypeScript and Tailwind CSS.

## Features

- Save the current tab or tabs to its left or right. Pinned tabs and tabs in browser groups are skipped.
- Organize saved links with groups, folders, stars, search, and a view grouped by site.
- Drag links to reorder them or move them between groups.
- Restore individual links or whole groups in the same window.
- Import OneTab text exports and export saved tabs.
- Use light or dark mode.

## Install

1. Install [Bun](https://bun.sh/), and GNU Make, then run `make install` and `make build`.
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
make install
make check
```

`make check` runs linting, formatting checks, unit tests, strict TypeScript checking, the build, and extension validation. The build creates `dist/TabTuck` and `dist/TabTuck.zip`. CI also runs secret scanning and browser tests.

The Makefile is the command entry point; its recipes use the portable Bun scripts in `package.json`. Bun commands remain available on machines without Make. Node.js is also required by the extension packaging and validation tools.

### Project structure

| Location            | Responsibility                                               |
| ------------------- | ------------------------------------------------------------ |
| `src/manifest.json` | Chrome extension entry points and permissions                |
| `src/background/`   | Service worker, storage access, and browser operations       |
| `src/shared/`       | Data model and icon definitions shared by worker and manager |
| `src/manager/`      | Manager page, UI components, controller, and Tailwind source |
| `src/icons/`        | Static extension and branding assets                         |
| `tests/unit/`       | Model, service worker, and validation tests                  |
| `tests/browser/`    | Browser workflows against the built extension                |
| `scripts/`          | Packaging and extension validation tooling                   |
| `dist/`             | Generated unpacked extension and ZIP; ignored by Git         |

The manager sends messages to the background worker for storage and browser operations. Shared modules must remain usable without a DOM; UI rendering belongs in the manager. `src/shared/types.ts` defines stored data and the message protocol. The build bundles the worker and manager TypeScript entry points into browser JavaScript, follows their imports automatically, and copies an explicit allowlist of static assets from `scripts/build.ts`. Chrome loads only the compiled output; TypeScript and development files are excluded from the package.

Edit `src/manager/manage.css`; compiled CSS is generated only in `dist/TabTuck/manager/`. Use `make watch-css` for CSS changes. Rebuild and reload the extension after TypeScript, HTML, or manifest changes.

TypeScript linting rejects explicit `any` and unsafe uses of types inferred as `any` from external APIs.

Use `make typecheck` for strict checking of extension code, scripts, and tests. Use `make test` for unit tests and `make lint` for linting. Browser checks use `make test-browser` and `make test-restore`, which build first. Set `HELIUM_EXECUTABLE` to an extension-capable Chromium executable and `TABTUCK_TEST_DIR` to an isolated artifact directory outside the repository. Use a separate directory for each browser check. Never point tests at a personal browser profile.

Saved tabs are stored locally in the browser's extension storage. Export a backup before uninstalling the extension or moving to a different browser profile.
